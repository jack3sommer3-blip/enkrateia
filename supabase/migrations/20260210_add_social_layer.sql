-- Social layer tables: follows, feed_items, likes, comments

create table if not exists follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (follower_id, following_id)
);

create index if not exists follows_following_idx on follows (following_id);
create index if not exists follows_follower_idx on follows (follower_id);

alter table follows enable row level security;

drop policy if exists "Follows readable" on follows;
drop policy if exists "Follows insertable by follower" on follows;
drop policy if exists "Follows deletable by follower" on follows;

create policy "Follows readable"
  on follows for select
  using (
    follower_id = auth.uid()
    or following_id = auth.uid()
    or exists (
      select 1 from profiles p
      where p.id = following_id and p.is_public = true
    )
  );

create policy "Follows insertable by follower"
  on follows for insert
  with check (follower_id = auth.uid());

create policy "Follows deletable by follower"
  on follows for delete
  using (follower_id = auth.uid());

create table if not exists feed_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  event_date date not null,
  event_type text not null,
  event_id uuid not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists feed_items_user_idx on feed_items (user_id);
create index if not exists feed_items_created_idx on feed_items (created_at desc);
create index if not exists feed_items_event_idx on feed_items (event_type, event_id);

alter table feed_items enable row level security;

drop policy if exists "Feed items owner access" on feed_items;
drop policy if exists "Feed items public select" on feed_items;

create policy "Feed items owner access"
  on feed_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Feed items public select"
  on feed_items for select
  using (
    exists (
      select 1
      from profiles p
      where p.id = user_id
        and p.is_public = true
        and (
          (event_type = 'workout' and p.show_workouts = true) or
          (event_type = 'reading' and p.show_reading = true) or
          (event_type = 'drinking' and p.show_drinking = true)
        )
    )
  );

create table if not exists likes (
  user_id uuid not null references auth.users(id) on delete cascade,
  feed_item_id uuid not null references feed_items(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, feed_item_id)
);

alter table likes enable row level security;

drop policy if exists "Likes readable" on likes;
drop policy if exists "Likes insertable by owner" on likes;
drop policy if exists "Likes deletable by owner" on likes;

create policy "Likes readable"
  on likes for select
  using (
    exists (
      select 1 from feed_items fi
      where fi.id = feed_item_id
        and (
          fi.user_id = auth.uid() or
          exists (
            select 1 from profiles p
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

create policy "Likes insertable by owner"
  on likes for insert
  with check (user_id = auth.uid());

create policy "Likes deletable by owner"
  on likes for delete
  using (user_id = auth.uid());

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feed_item_id uuid not null references feed_items(id) on delete cascade,
  body text not null,
  created_at timestamptz default now()
);

alter table comments enable row level security;

drop policy if exists "Comments readable" on comments;
drop policy if exists "Comments insertable by owner" on comments;
drop policy if exists "Comments updatable by owner" on comments;
drop policy if exists "Comments deletable by owner" on comments;

create policy "Comments readable"
  on comments for select
  using (
    exists (
      select 1 from feed_items fi
      where fi.id = feed_item_id
        and (
          fi.user_id = auth.uid() or
          exists (
            select 1 from profiles p
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

create policy "Comments insertable by owner"
  on comments for insert
  with check (user_id = auth.uid());

create policy "Comments updatable by owner"
  on comments for update
  using (user_id = auth.uid());

create policy "Comments deletable by owner"
  on comments for delete
  using (user_id = auth.uid());
