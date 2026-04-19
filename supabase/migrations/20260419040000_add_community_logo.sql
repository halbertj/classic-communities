-- ===============================================================
-- Add `logo_path` column on public.communities and a dedicated
-- `community-logos` storage bucket.
--
-- A community logo is a small branded mark (e.g. the neighborhood's
-- sign/monogram). We give it its own bucket so we can later tighten
-- allowed MIME types (SVG/PNG) without impacting the broader
-- `community-photos` gallery bucket.
--
-- Like `cover_photo_path` and `site_plan_path`, this column is a
-- plain text pointer to the Storage object key. Application code is
-- responsible for removing the old object when the field is replaced
-- or cleared; on community delete the object is orphaned (matching
-- the existing pattern for the other path columns).
-- ===============================================================

alter table public.communities
  add column logo_path text;

-- ---------------------------------------------------------------
-- Storage: community-logos (public bucket)
-- Same access pattern as the other community buckets: anyone can
-- read (so the logo can be embedded on public pages), admins only
-- can write.
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('community-logos', 'community-logos', true)
on conflict (id) do nothing;

create policy "community logos readable by anyone"
  on storage.objects for select
  using (bucket_id = 'community-logos');

create policy "community logos insertable by admins"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'community-logos' and public.is_admin());

create policy "community logos updatable by admins"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'community-logos' and public.is_admin())
  with check (bucket_id = 'community-logos' and public.is_admin());

create policy "community logos deletable by admins"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'community-logos' and public.is_admin());
