-- Allow followers to read feed_items (respecting per-event visibility flags)

alter table public.feed_items enable row level security;

drop policy if exists "Feed items public select" on public.feed_items;

grant select on public.feed_items to authenticated;

create policy "Feed items public or follower select"
  on public.feed_items for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = feed_items.user_id
        and (
          p.is_public = true
          or exists (
            select 1 from public.follows f
            where f.follower_id = auth.uid()
              and f.following_id = feed_items.user_id
          )
        )
        and (
          (feed_items.event_type = 'workout' and p.show_workouts = true) or
          (feed_items.event_type = 'reading' and p.show_reading = true) or
          (feed_items.event_type = 'drinking' and p.show_drinking = true)
        )
    )
    or feed_items.user_id = auth.uid()
  );
