-- Coffee Brewing: cloud sync table.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
--
-- One row per account holds the whole app state as JSON (the same shape as
-- Gear -> Export). updated_at is the app's own millisecond timestamp and is
-- used to detect when two devices wrote at the same time.

create table if not exists public.brew_state (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data       jsonb  not null,
  updated_at bigint not null,
  modified   timestamptz not null default now()
);

alter table public.brew_state enable row level security;

-- Each signed-in person can only see and change their own row.
drop policy if exists "read own state" on public.brew_state;
create policy "read own state" on public.brew_state
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "add own state" on public.brew_state;
create policy "add own state" on public.brew_state
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "change own state" on public.brew_state;
create policy "change own state" on public.brew_state
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "remove own state" on public.brew_state;
create policy "remove own state" on public.brew_state
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.brew_state from anon;
grant select, insert, update, delete on public.brew_state to authenticated;

-- Keep "modified" current on every write (handy when looking at the table).
create or replace function public.brew_state_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.modified := now();
  return new;
end $$;

drop trigger if exists brew_state_touch on public.brew_state;
create trigger brew_state_touch before update on public.brew_state
  for each row execute function public.brew_state_touch();
