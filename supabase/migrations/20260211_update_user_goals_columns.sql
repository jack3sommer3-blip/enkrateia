-- Extend user_goals for enabled categories + onboarding state
alter table public.user_goals
  add column if not exists enabled_categories text[] not null default '{exercise,sleep,diet,reading}',
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists created_at timestamptz default now();

-- Backfill enabled_categories if null
update public.user_goals
set enabled_categories = '{exercise,sleep,diet,reading}'
where enabled_categories is null;

-- Ensure updated_at exists
alter table public.user_goals
  add column if not exists updated_at timestamptz default now();
