-- Add steps column for daily log summary queries
alter table daily_logs
  add column if not exists steps integer;

-- Backfill steps from stored JSON when possible
update daily_logs
set steps = (data->'workouts'->>'stepsText')::integer
where steps is null
  and (data->'workouts'->>'stepsText') ~ '^[0-9]+$';
