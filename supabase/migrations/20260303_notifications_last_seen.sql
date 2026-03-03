-- Add notifications last seen timestamp to profiles

alter table public.profiles
  add column if not exists notifications_last_seen_at timestamptz default now();

alter table public.profiles enable row level security;

drop policy if exists "Profiles are updatable by owner" on public.profiles;
create policy "Profiles are updatable by owner"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
