-- Add community score column for new Community category
alter table daily_logs
  add column if not exists community_score numeric not null default 0;
