-- Security hardening for multi-user isolation

-- Restrict public access to profile emails
revoke select (email) on table public.profiles from anon, authenticated;

-- Ensure update policies enforce ownership (with check)
alter table public.profiles enable row level security;

drop policy if exists "Profiles are updatable by owner" on public.profiles;
create policy "Profiles are updatable by owner"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

alter table public.user_goals enable row level security;

drop policy if exists "User goals are updatable by owner" on public.user_goals;
create policy "User goals are updatable by owner"
  on public.user_goals for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.daily_logs enable row level security;

drop policy if exists "Daily logs are updatable by owner" on public.daily_logs;
create policy "Daily logs are updatable by owner"
  on public.daily_logs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.drinking_events enable row level security;

drop policy if exists "Drinking events are updatable by owner" on public.drinking_events;
create policy "Drinking events are updatable by owner"
  on public.drinking_events for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Comments: restrict visibility to feed items the requester can see
alter table public.comments enable row level security;

drop policy if exists "comments_select_auth" on public.comments;
drop policy if exists "comments_insert_own" on public.comments;
drop policy if exists "comments_delete_own" on public.comments;
drop policy if exists "Comments readable" on public.comments;
drop policy if exists "Comments insertable by owner" on public.comments;
drop policy if exists "Comments updatable by owner" on public.comments;
drop policy if exists "Comments deletable by owner" on public.comments;

create policy "comments_select_visible"
  on public.comments for select
  using (
    exists (
      select 1 from public.feed_items fi
      where fi.id = comments.feed_item_id
        and (
          fi.user_id = auth.uid()
          or exists (
            select 1 from public.profiles p
            where p.id = fi.user_id
              and p.is_public = true
              and (
                (fi.event_type = 'workout' and p.show_workouts = true) or
                (fi.event_type = 'reading' and p.show_reading = true) or
                (fi.event_type = 'drinking' and p.show_drinking = true)
              )
          )
        )
    )
  );

create policy "comments_insert_own"
  on public.comments for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.feed_items fi
      where fi.id = comments.feed_item_id
        and (
          fi.user_id = auth.uid()
          or exists (
            select 1 from public.profiles p
            where p.id = fi.user_id
              and p.is_public = true
              and (
                (fi.event_type = 'workout' and p.show_workouts = true) or
                (fi.event_type = 'reading' and p.show_reading = true) or
                (fi.event_type = 'drinking' and p.show_drinking = true)
              )
          )
        )
    )
  );

create policy "comments_delete_own"
  on public.comments for delete
  using (author_id = auth.uid());

-- Likes: prevent liking items the requester cannot view
alter table public.likes enable row level security;

drop policy if exists "Likes insertable by owner" on public.likes;
create policy "Likes insertable by owner"
  on public.likes for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.feed_items fi
      where fi.id = likes.feed_item_id
        and (
          fi.user_id = auth.uid()
          or exists (
            select 1 from public.profiles p
            where p.id = fi.user_id
              and p.is_public = true
              and (
                (fi.event_type = 'workout' and p.show_workouts = true) or
                (fi.event_type = 'reading' and p.show_reading = true) or
                (fi.event_type = 'drinking' and p.show_drinking = true)
              )
          )
        )
    )
  );
