-- Enkrateia Supabase schema

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  username text unique not null,
  first_name text not null,
  last_name text not null,
  created_at timestamptz default now()
);

create table if not exists daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  data jsonb not null,
  steps integer,
  total_score numeric not null,
  workout_score numeric not null,
  sleep_score numeric not null,
  diet_score numeric not null,
  reading_score numeric not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, date)
);

create table if not exists user_goals (
  user_id uuid primary key references auth.users (id) on delete cascade,
  goals jsonb not null,
  enabled_categories text[] not null default '{exercise,sleep,diet,reading}',
  onboarding_completed boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table profiles enable row level security;
alter table daily_logs enable row level security;
alter table user_goals enable row level security;

create policy "Profiles are readable by owner"
  on profiles for select
  using (auth.uid() = id);

create policy "Profiles are insertable by owner"
  on profiles for insert
  with check (auth.uid() = id);

create policy "Profiles are updatable by owner"
  on profiles for update
  using (auth.uid() = id);

create policy "Daily logs are readable by owner"
  on daily_logs for select
  using (auth.uid() = user_id);

create policy "Daily logs are insertable by owner"
  on daily_logs for insert
  with check (auth.uid() = user_id);

create policy "Daily logs are updatable by owner"
  on daily_logs for update
  using (auth.uid() = user_id);

create policy "Daily logs are deletable by owner"
  on daily_logs for delete
  using (auth.uid() = user_id);

create policy "User goals are readable by owner"
  on user_goals for select
  using (auth.uid() = user_id);

create policy "User goals are insertable by owner"
  on user_goals for insert
  with check (auth.uid() = user_id);

create policy "User goals are updatable by owner"
  on user_goals for update
  using (auth.uid() = user_id);
