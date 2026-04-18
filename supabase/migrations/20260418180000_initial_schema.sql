-- ===============================================================
-- Initial schema for Classic Communities
--
-- Includes:
--   - profiles (one row per auth user, holds role: 'user' | 'admin')
--   - addresses (street components + latitude/longitude)
--   - communities (name, slug, dates, cover photo path, FK to addresses)
--   - is_admin() helper function (avoids RLS recursion)
--   - auto-create profile on signup (handle_new_user trigger)
--   - updated_at triggers on mutable tables
--   - RLS: public read for addresses & communities, admin-only writes
--   - Storage bucket "community-photos" with matching RLS policies
--
-- Bootstrap note:
--   After a new user signs up, a profile is created with role='user'.
--   To grant yourself admin, run in the SQL editor:
--     update public.profiles set role = 'admin' where id = 'YOUR-UUID';
--   You can find your UUID in Authentication → Users.
-- ===============================================================

-- ---------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ---------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------
-- profiles
-- One row per auth.users entry. Role gates admin-only operations.
-- ---------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null default 'user',
  email       text,
  full_name   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint profiles_role_valid check (role in ('user', 'admin'))
);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row whenever a new auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------
-- is_admin() helper
-- SECURITY DEFINER so it can read profiles without tripping RLS
-- from within other RLS policies.
-- ---------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------
-- addresses
-- ---------------------------------------------------------------
create table if not exists public.addresses (
  id            uuid primary key default gen_random_uuid(),
  line1         text not null,
  line2         text,
  city          text not null,
  state         text not null,
  postal_code   text,
  country       text not null default 'US',
  formatted     text,
  latitude      numeric(9, 6),
  longitude     numeric(9, 6),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint addresses_lat_range  check (latitude  is null or latitude  between  -90  and  90),
  constraint addresses_lng_range  check (longitude is null or longitude between -180 and 180),
  constraint addresses_latlng_paired check (
    (latitude is null and longitude is null) or
    (latitude is not null and longitude is not null)
  )
);

create index if not exists addresses_latlng_idx
  on public.addresses (latitude, longitude)
  where latitude is not null and longitude is not null;

create trigger trg_addresses_updated_at
  before update on public.addresses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------
-- communities
-- ---------------------------------------------------------------
create table if not exists public.communities (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  slug              text not null unique,
  date_started      date,
  date_completed    date,
  cover_photo_path  text,
  address_id        uuid references public.addresses(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint communities_dates_ordered
    check (date_completed is null or date_started is null or date_completed >= date_started),
  constraint communities_slug_format
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create index if not exists communities_address_idx
  on public.communities (address_id);

create trigger trg_communities_updated_at
  before update on public.communities
  for each row execute function public.set_updated_at();

-- ===============================================================
-- Row Level Security
-- ===============================================================

-- profiles ------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profiles readable by owner"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "profiles readable by admins"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

-- Users can update their own profile, but cannot escalate their role.
create policy "profiles updatable by owner"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = 'user');

-- Admins can update any profile (including granting admin).
create policy "profiles updatable by admins"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- addresses -----------------------------------------------------
alter table public.addresses enable row level security;

create policy "addresses readable by anyone"
  on public.addresses for select
  using (true);

create policy "addresses writable by admins"
  on public.addresses for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- communities ---------------------------------------------------
alter table public.communities enable row level security;

create policy "communities readable by anyone"
  on public.communities for select
  using (true);

create policy "communities writable by admins"
  on public.communities for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ===============================================================
-- Storage: community-photos (public bucket)
-- ===============================================================
insert into storage.buckets (id, name, public)
values ('community-photos', 'community-photos', true)
on conflict (id) do nothing;

-- Anyone can read community photos (bucket is public anyway,
-- but the policy makes this explicit and survives RLS audits).
create policy "community photos readable by anyone"
  on storage.objects for select
  using (bucket_id = 'community-photos');

create policy "community photos insertable by admins"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'community-photos' and public.is_admin());

create policy "community photos updatable by admins"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'community-photos' and public.is_admin())
  with check (bucket_id = 'community-photos' and public.is_admin());

create policy "community photos deletable by admins"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'community-photos' and public.is_admin());
