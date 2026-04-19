-- ===============================================================
-- Drop the after-delete trigger on public.community_photos that
-- tried to clean up the backing storage.objects row directly.
--
-- Supabase now refuses direct writes to the storage.* tables
-- ("Direct deletion from storage tables is not allowed. Use the
-- Storage API instead."), which causes every community_photos row
-- deletion to fail.
--
-- Storage cleanup is moved to application code (the
-- `removeCommunityPhoto` server action), which already uses the
-- Storage API and matches the pattern used for cover photos and
-- site plans.
-- ===============================================================

drop trigger if exists trg_community_photos_delete_object
  on public.community_photos;

drop function if exists public.delete_community_photo_object();
