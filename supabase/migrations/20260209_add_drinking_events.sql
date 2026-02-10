-- Drinking events table

create table if not exists drinking_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  tier int2 not null,
  drinks int2 not null default 0,
  note text,
  created_at timestamptz default now()
);

create index if not exists drinking_events_user_date_idx
  on drinking_events (user_id, date);

alter table drinking_events enable row level security;

drop policy if exists "Drinking events are readable by owner" on drinking_events;
drop policy if exists "Drinking events are insertable by owner" on drinking_events;
drop policy if exists "Drinking events are updatable by owner" on drinking_events;
drop policy if exists "Drinking events are deletable by owner" on drinking_events;

create policy "Drinking events are readable by owner"
  on drinking_events for select
  using (auth.uid() = user_id);

create policy "Drinking events are insertable by owner"
  on drinking_events for insert
  with check (auth.uid() = user_id);

create policy "Drinking events are updatable by owner"
  on drinking_events for update
  using (auth.uid() = user_id);

create policy "Drinking events are deletable by owner"
  on drinking_events for delete
  using (auth.uid() = user_id);
