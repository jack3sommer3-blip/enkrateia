-- Add social profile fields and public read access

alter table profiles
  add column if not exists display_name text,
  add column if not exists bio text,
  add column if not exists avatar_url text,
  add column if not exists location text,
  add column if not exists website text;

-- Case-insensitive unique usernames
create unique index if not exists profiles_username_lower_unique
  on profiles (lower(username));

-- RLS: allow public profile reads, owner-only inserts/updates
drop policy if exists "Profiles are readable by owner" on profiles;
drop policy if exists "Profiles are insertable by owner" on profiles;
drop policy if exists "Profiles are updatable by owner" on profiles;

create policy "Profiles are readable by anyone"
  on profiles for select
  using (true);

create policy "Profiles are insertable by owner"
  on profiles for insert
  with check (auth.uid() = id);

create policy "Profiles are updatable by owner"
  on profiles for update
  using (auth.uid() = id);
