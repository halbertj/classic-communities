-- ===============================================================
-- Add `starred` column on public.communities.
--
-- Marks a community as "featured" so the home page can spotlight a
-- small hand-picked set above the full map/list. Defaults to false
-- so existing rows are unaffected. A partial index keeps the
-- "show me the featured ones" query cheap even as the table grows.
-- ===============================================================

alter table public.communities
  add column starred boolean not null default false;

create index communities_starred_idx
  on public.communities (name)
  where starred;
