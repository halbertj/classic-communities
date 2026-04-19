-- ===============================================================
-- Add `description` column on public.communities.
--
-- Long-form, admin-authored prose about a community — shown on the
-- public detail page under "About this community" when set. Stored
-- as plain text (no markdown today; we render it with `whitespace-pre-line`
-- so paragraph breaks from the admin textarea survive).
--
-- Nullable: communities created before this column, or minted via the
-- new-community form without copy, fall back to the auto-generated
-- one-liner the detail page already produces from name/type/location.
-- ===============================================================

alter table public.communities
  add column description text;
