-- ===============================================================
-- Add `site_plan_path` column on public.communities and a
-- dedicated `community-site-plans` storage bucket.
--
-- A site plan is the master diagram for a community (lot layout,
-- streets, amenities). It's frequently a PDF or a large image, so
-- we keep it in its own bucket rather than mixing it with the
-- per-community gallery photos in `community-photos`. That also
-- lets us lock allowed MIME types down in the future without
-- impacting the photo gallery.
--
-- Like `cover_photo_path`, this column is a plain `text` pointer
-- to the Storage object key (not a foreign key). When the field is
-- replaced or cleared, application code is responsible for removing
-- the old object; when a community row is deleted the object is
-- orphaned (matching the existing cover_photo_path behavior).
-- ===============================================================

alter table public.communities
  add column site_plan_path text;

-- ---------------------------------------------------------------
-- Storage: community-site-plans (public bucket)
-- Same access pattern as community-photos: anyone can read,
-- admins only can write.
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('community-site-plans', 'community-site-plans', true)
on conflict (id) do nothing;

create policy "community site plans readable by anyone"
  on storage.objects for select
  using (bucket_id = 'community-site-plans');

create policy "community site plans insertable by admins"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'community-site-plans' and public.is_admin());

create policy "community site plans updatable by admins"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'community-site-plans' and public.is_admin())
  with check (bucket_id = 'community-site-plans' and public.is_admin());

create policy "community site plans deletable by admins"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'community-site-plans' and public.is_admin());
