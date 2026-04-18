-- ===============================================================
-- Add community_type enum and column on public.communities
--
-- Values:
--   single_family  → "Single family"
--   townhome       → "Townhome"
--   mixed          → "Mixed"
--
-- Notes:
--   - Stored as snake_case in the DB; UI renders display labels.
--   - Column is nullable so a community can be created before its
--     type is finalized. Tighten to NOT NULL via a future migration
--     if/when that becomes a product requirement.
-- ===============================================================

create type public.community_type as enum (
  'single_family',
  'townhome',
  'mixed'
);

alter table public.communities
  add column community_type public.community_type;

-- Index helps if you later filter listing pages by type
-- (e.g., /communities?type=townhome). Partial index keeps it small
-- by excluding rows where the type isn't set.
create index if not exists communities_type_idx
  on public.communities (community_type)
  where community_type is not null;
