-- ===============================================================
-- public.community_videos
--
-- One row per video attached to a community. Mirrors the design of
-- `community_photos`: a child table (rather than an array on
-- `communities`) so each video can carry per-video metadata
-- (caption, MIME type, duration, optional poster image, ordering,
-- uploader) and so individual videos can be added/reordered/deleted
-- without rewriting the entire list.
--
-- Storage:
--   Video files live in a dedicated public bucket `community-videos`
--   created below. We give videos their own bucket (rather than
--   reusing `community-photos`) so we can later tune size/MIME
--   constraints, CDN behaviour, and lifecycle rules independently
--   of the image gallery.
--
--   The optional `poster_path` references an image in the existing
--   `community-photos` bucket — posters are still images and benefit
--   from the same access policies/cache behaviour as gallery photos.
--
--   As with the photos table, storage cleanup happens in application
--   code (server actions) because Supabase forbids direct writes to
--   `storage.objects` from triggers.
-- ===============================================================

create table if not exists public.community_videos (
  id                uuid primary key default gen_random_uuid(),
  community_id      uuid not null references public.communities(id) on delete cascade,
  storage_path      text not null,
  poster_path       text,
  mime_type         text,
  duration_seconds  numeric(10, 3),
  display_order     integer not null default 0,
  caption           text,
  uploaded_by       uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint community_videos_storage_path_not_blank
    check (length(btrim(storage_path)) > 0),
  constraint community_videos_duration_non_negative
    check (duration_seconds is null or duration_seconds >= 0)
);

-- Lookups are almost always "all videos for this community, in order".
create index if not exists community_videos_community_order_idx
  on public.community_videos (community_id, display_order, created_at);

-- A given storage object should back at most one row.
create unique index if not exists community_videos_storage_path_key
  on public.community_videos (storage_path);

create trigger trg_community_videos_updated_at
  before update on public.community_videos
  for each row execute function public.set_updated_at();

-- ===============================================================
-- Row Level Security
-- Mirrors `community_photos` / `communities`: public read, admin-only write.
-- ===============================================================
alter table public.community_videos enable row level security;

create policy "community_videos readable by anyone"
  on public.community_videos for select
  using (true);

create policy "community_videos writable by admins"
  on public.community_videos for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------
-- Storage: community-videos (public bucket)
-- Same access pattern as the other community buckets: anyone can
-- read (so videos can be embedded on public pages), admins only
-- can write.
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('community-videos', 'community-videos', true)
on conflict (id) do nothing;

create policy "community videos readable by anyone"
  on storage.objects for select
  using (bucket_id = 'community-videos');

create policy "community videos insertable by admins"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'community-videos' and public.is_admin());

create policy "community videos updatable by admins"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'community-videos' and public.is_admin())
  with check (bucket_id = 'community-videos' and public.is_admin());

create policy "community videos deletable by admins"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'community-videos' and public.is_admin());
