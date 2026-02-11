-- RPC for fetching comment counts by feed_item_id
create or replace function public.get_comment_counts(feed_ids uuid[])
returns table (feed_item_id uuid, count bigint)
language sql stable as $$
  select feed_item_id, count(*)::bigint
  from public.comments
  where feed_item_id = any(feed_ids)
  group by feed_item_id
$$;
