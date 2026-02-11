-- Cleanup any future daily_logs rows that are empty/zero
-- Uses total_score and category scores; removes only truly empty future rows
DELETE FROM daily_logs
WHERE date > CURRENT_DATE
  AND COALESCE(total_score, 0) = 0
  AND COALESCE(workout_score, 0) = 0
  AND COALESCE(sleep_score, 0) = 0
  AND COALESCE(diet_score, 0) = 0
  AND COALESCE(reading_score, 0) = 0;
