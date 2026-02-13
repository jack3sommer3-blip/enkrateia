-- Badges definitions + user_badges join table

create table if not exists public.badges (
  id text primary key,
  name text not null,
  description text not null,
  icon_key text,
  created_at timestamptz default now()
);

create table if not exists public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_id text not null references public.badges(id) on delete cascade,
  earned_at timestamptz not null default now(),
  unique (user_id, badge_id)
);

create index if not exists user_badges_user_idx on public.user_badges (user_id);
create index if not exists user_badges_badge_idx on public.user_badges (badge_id);

alter table public.badges enable row level security;
alter table public.user_badges enable row level security;

-- Badges are readable by anyone
create policy "Badges are readable"
  on public.badges for select
  using (true);

-- User badges: owner can read; public can read if profile is public
create policy "User badges are readable"
  on public.user_badges for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = user_badges.user_id and p.is_public = true
    )
  );

create policy "User badges are insertable by owner"
  on public.user_badges for insert
  with check (user_id = auth.uid());

-- Seed 007 badge
insert into public.badges (id, name, description, icon_key)
values (
  'bond_007',
  '007',
  'James Bond is the ultimate operator. This badge is earned by logging 7 days in a row. You are still early on your journey, but you are on the right track. Perhaps a vesper martini to celebrate? Shaken, of course.',
  '007'
)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  icon_key = excluded.icon_key;
