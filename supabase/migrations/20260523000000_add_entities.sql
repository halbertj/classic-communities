-- ===============================================================
-- entities
--
-- Legal entities owned/operated by Classic. Starts intentionally
-- minimal (just a name) — additional columns (EIN, registration
-- state, formation date, etc.) will be layered on in follow-up
-- migrations as the use cases firm up (linking to homes sold,
-- pulling county records, etc.).
--
-- Naming follows the existing convention (singular column names,
-- timestamptz audit columns, `updated_at` trigger). RLS mirrors
-- `communities`: public read so the data can be referenced from
-- the public site if we ever need it, admin-only writes.
-- ===============================================================

create table if not exists public.entities (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint entities_name_not_blank check (length(btrim(name)) > 0)
);

-- Case-insensitive uniqueness so two entities can't differ only in
-- casing/whitespace. Admins occasionally paste names from different
-- sources, and "Classic Communities, LLC" vs "CLASSIC COMMUNITIES, LLC"
-- should round-trip to the same row.
create unique index if not exists entities_name_ci_unique
  on public.entities (lower(btrim(name)));

create trigger trg_entities_updated_at
  before update on public.entities
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------
alter table public.entities enable row level security;

create policy "entities readable by anyone"
  on public.entities for select
  using (true);

create policy "entities writable by admins"
  on public.entities for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
