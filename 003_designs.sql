-- Migration 003: saved designs (Part 06). Run after 001/002. Safe to re-run.
create table if not exists public.designs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) <= 60),
  data jsonb not null check (pg_column_size(data) < 900000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists designs_user_updated on public.designs (user_id, updated_at desc);
alter table public.designs enable row level security;
drop policy if exists "designs_own" on public.designs;
create policy "designs_own" on public.designs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
