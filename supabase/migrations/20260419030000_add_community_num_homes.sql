-- ===============================================================
-- Add num_homes column on public.communities
--
-- Total number of homes built in the community. Nullable so a
-- community can be created before the count is known (e.g. while
-- a plan is still being finalized). A zero-row check keeps us from
-- accidentally storing negative counts from a bad form submission.
-- ===============================================================

alter table public.communities
  add column num_homes integer;

alter table public.communities
  add constraint communities_num_homes_nonneg
  check (num_homes is null or num_homes >= 0);
