-- ===============================================================
-- Add `archived` + `archived_at` columns on public.communities.
--
-- Communities aren't hard-deleted from the admin UI — they're archived
-- (soft-deleted) so the team can restore them later if needed. The
-- public site (home map, /communities listing, /communities/[slug])
-- filters archived rows out entirely.
--
--   * `archived`    — the flag the admin UI toggles. Defaults to false
--                     so existing rows remain visible.
--   * `archived_at` — when it was archived. Nullable; set/cleared in
--                     lockstep with `archived` by the server action.
--
-- A partial index on the default "visible" subset keeps the common
-- `where not archived` filter cheap as the table grows.
-- ===============================================================

alter table public.communities
  add column archived boolean not null default false,
  add column archived_at timestamptz;

create index communities_not_archived_idx
  on public.communities (name)
  where not archived;
