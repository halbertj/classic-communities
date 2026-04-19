-- ===============================================================
-- public.community_photos
--
-- One row per photo attached to a community. Stored separately
-- (rather than as an array on `communities`) so each photo can carry
-- per-photo metadata (caption, alt text, ordering, uploader) and so
-- single photos can be added/reordered/deleted without rewriting the
-- entire list.
--
-- The `cover_photo_path` column on `communities` is intentionally
-- left in place: it's a fast-path for list/hero views that don't
-- want to join. Admins can keep it in sync by setting it to one of
-- this table's `storage_path` values when they pick a cover.
--
-- Storage:
--   Files live in the public `community-photos` bucket created in
--   the initial migration (same bucket already used for cover
--   photos). The bucket's RLS policies (public read, admin write)
--   are unchanged. An after-delete trigger removes the matching
--   storage object so deleting a photo row never leaks files.
-- ===============================================================

create table if not exists public.community_photos (
  id              uuid primary key default gen_random_uuid(),
  community_id    uuid not null references public.communities(id) on delete cascade,
  storage_path    text not null,
  display_order   integer not null default 0,
  caption         text,
  alt_text        text,
  uploaded_by     uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint community_photos_storage_path_not_blank
    check (length(btrim(storage_path)) > 0)
);

-- Lookups are almost always "all photos for this community, in order".
create index if not exists community_photos_community_order_idx
  on public.community_photos (community_id, display_order, created_at);

-- Same storage_path should never appear twice (would mean two rows
-- pointing at the same object — confusing, and breaks the after-delete
-- cleanup trigger which deletes by path).
create unique index if not exists community_photos_storage_path_key
  on public.community_photos (storage_path);

create trigger trg_community_photos_updated_at
  before update on public.community_photos
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------
-- Storage cleanup: when a community_photos row is deleted (either
-- directly or via the on-delete-cascade from communities), drop the
-- backing object from the community-photos bucket. SECURITY DEFINER
-- so it works regardless of who triggered the delete.
-- ---------------------------------------------------------------
create or replace function public.delete_community_photo_object()
returns trigger
language plpgsql
security definer
set search_path = public, storage
as $$
begin
  delete from storage.objects
  where bucket_id = 'community-photos'
    and name = old.storage_path;
  return old;
end;
$$;

create trigger trg_community_photos_delete_object
  after delete on public.community_photos
  for each row execute function public.delete_community_photo_object();

-- ===============================================================
-- Row Level Security
-- Mirrors `communities`: public read, admin-only write.
-- ===============================================================
alter table public.community_photos enable row level security;

create policy "community_photos readable by anyone"
  on public.community_photos for select
  using (true);

create policy "community_photos writable by admins"
  on public.community_photos for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
