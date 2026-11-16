-- Migration 002: contents, favorites, stats. Run AFTER 001_profiles.sql. Safe to re-run.
create table if not exists public.contents (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) <= 120),
  body text not null check (char_length(body) between 1 and 5000),
  type text not null default 'caption' check (type in ('caption','shayari','poem','story','rhymes','quote')),
  category text not null,
  tags text[] not null default '{}',
  language text not null default 'bn',
  status text not null default 'draft' check (status in ('draft','pending','published','rejected')),
  featured boolean not null default false,
  author_id uuid references public.profiles(id) on delete set null,
  views int not null default 0, copies int not null default 0,
  shares int not null default 0, likes int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists contents_status_created on public.contents (status, created_at desc);
create index if not exists contents_category on public.contents (category);
create index if not exists contents_tags on public.contents using gin (tags);

alter table public.contents enable row level security;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','moderator'));
$$;

drop policy if exists "contents_read_published" on public.contents;
create policy "contents_read_published" on public.contents for select
  using (status = 'published' or author_id = auth.uid() or public.is_staff());

-- Users may submit only as 'pending' or 'draft' for themselves
drop policy if exists "contents_insert_own" on public.contents;
create policy "contents_insert_own" on public.contents for insert to authenticated
  with check (author_id = auth.uid() and status in ('draft','pending'));

drop policy if exists "contents_update_own_unpublished" on public.contents;
create policy "contents_update_own_unpublished" on public.contents for update to authenticated
  using (author_id = auth.uid() and status in ('draft','pending','rejected'))
  with check (author_id = auth.uid() and status in ('draft','pending'));

drop policy if exists "contents_staff_all" on public.contents;
create policy "contents_staff_all" on public.contents for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  content_id uuid not null references public.contents(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, content_id)
);
alter table public.favorites enable row level security;
drop policy if exists "fav_own" on public.favorites;
create policy "fav_own" on public.favorites for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Safe counter bump (whitelisted fields only; clients can't write counts directly)
create or replace function public.bump_stat(p_id uuid, p_field text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_field not in ('views','copies','shares','likes') then raise exception 'invalid field'; end if;
  execute format('update public.contents set %I = %I + 1 where id = $1 and status = ''published''', p_field, p_field) using p_id;
end $$;
grant execute on function public.bump_stat(uuid, text) to anon, authenticated;

-- Make yourself admin ONCE from the SQL editor (replace the email):
-- update public.profiles set role='admin' where id = (select id from auth.users where email='you@example.com');
