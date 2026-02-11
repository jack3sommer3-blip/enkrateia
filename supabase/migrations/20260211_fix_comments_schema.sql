-- Fix comments schema + RLS for MVP (idempotent)

-- Ensure author_id column exists
alter table public.comments
  add column if not exists author_id uuid;

-- Backfill author_id from legacy user_id if present
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'comments'
      and column_name = 'user_id'
  ) then
    update public.comments
    set author_id = user_id
    where author_id is null;
  end if;
end $$;

-- Delete orphan rows where author_id is still null
delete from public.comments
where author_id is null;

-- Enforce NOT NULL after cleanup
alter table public.comments
  alter column author_id set not null;

-- Add body nonempty constraint if missing
do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where c.conname = 'comments_body_nonempty'
      and n.nspname = 'public'
      and t.relname = 'comments'
  ) then
    alter table public.comments
      add constraint comments_body_nonempty
      check (char_length(body) > 0);
  end if;
end $$;

-- Indexes
create index if not exists comments_feed_item_created_idx
  on public.comments (feed_item_id, created_at);

create index if not exists comments_author_created_idx
  on public.comments (author_id, created_at);

-- RLS policies (MVP: authenticated can read all comments)
alter table public.comments enable row level security;

drop policy if exists "Comments readable" on public.comments;
drop policy if exists "Comments insertable by owner" on public.comments;
drop policy if exists "Comments updatable by owner" on public.comments;
drop policy if exists "Comments deletable by owner" on public.comments;

create policy "comments_select_auth"
  on public.comments for select
  to authenticated
  using (true);

create policy "comments_insert_own"
  on public.comments for insert
  to authenticated
  with check (author_id = auth.uid());

create policy "comments_delete_own"
  on public.comments for delete
  to authenticated
  using (author_id = auth.uid());

-- Drop legacy user_id column if present
alter table public.comments
  drop column if exists user_id;
