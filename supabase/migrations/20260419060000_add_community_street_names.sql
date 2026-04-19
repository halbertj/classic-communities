-- ===============================================================
-- Add `street_names` column on public.communities.
--
-- Stores the list of street names that make up a community (e.g.
-- "Maple Lane", "Oak Circle"). Admin-only editable today, and a
-- natural anchor for search / homepage-level "streets in this
-- community" UI later. Modeled as a text[] so the admin can edit
-- the whole list with a single textarea and we avoid the
-- complexity of a child table until it's actually needed.
--
-- `not null default '{}'` so existing rows and future inserts
-- that omit the field both land as empty arrays — the app never
-- has to guard against `null` when iterating.
-- ===============================================================

alter table public.communities
  add column street_names text[] not null default '{}';
