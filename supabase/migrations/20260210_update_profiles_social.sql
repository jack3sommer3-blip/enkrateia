-- Update profiles for social layer and privacy

alter table profiles
  add column if not exists profile_photo_url text,
  add column if not exists is_public boolean not null default true,
  add column if not exists show_workouts boolean not null default true,
  add column if not exists show_reading boolean not null default true,
  add column if not exists show_drinking boolean not null default true;

drop policy if exists "Profiles are readable by public or owner" on profiles;
drop policy if exists "Profiles are readable by anyone" on profiles;

create policy "Profiles are readable by public or owner"
  on profiles for select
  using (is_public = true or auth.uid() = id);
