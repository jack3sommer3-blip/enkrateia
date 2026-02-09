-- User goals storage

create table if not exists user_goals (
  user_id uuid primary key references auth.users (id) on delete cascade,
  goals jsonb not null,
  updated_at timestamptz default now()
);

alter table user_goals enable row level security;

drop policy if exists "User goals are readable by owner" on user_goals;
drop policy if exists "User goals are insertable by owner" on user_goals;
drop policy if exists "User goals are updatable by owner" on user_goals;

create policy "User goals are readable by owner"
  on user_goals for select
  using (auth.uid() = user_id);

create policy "User goals are insertable by owner"
  on user_goals for insert
  with check (auth.uid() = user_id);

create policy "User goals are updatable by owner"
  on user_goals for update
  using (auth.uid() = user_id);
