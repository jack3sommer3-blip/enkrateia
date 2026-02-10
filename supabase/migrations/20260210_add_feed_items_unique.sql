-- Ensure feed_items rows are unique per user/event to support idempotent upserts
create unique index if not exists feed_items_user_event_unique
  on feed_items (user_id, event_type, event_id);
