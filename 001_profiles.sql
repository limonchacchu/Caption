-- Migration 001: profiles + RLS (Part 03). Safe to re-run. Backup your DB first!
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique check (username ~ '^[a-zA-Z0-9_]{3,30}$'),
  display_name text check (char_length(display_name) <= 60),
  bio text check (char_length(bio) <= 300),
  avatar_url text,
  role text not null default 'user' check (role in ('user','moderator','admin')),
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_public_read" on public.profiles;
create policy "profiles_public_read" on public.profiles
  for select using (is_public or auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Users must NOT be able to promote themselves: block role changes from clients.
create or replace function public.protect_profile_role()
returns trigger language plpgsql as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null then
    new.role := old.role;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_protect_profile_role on public.profiles;
create trigger trg_protect_profile_role before update on public.profiles
  for each row execute function public.protect_profile_role();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill existing users (does not touch existing profiles)
insert into public.profiles (id, display_name)
select id, split_part(email,'@',1) from auth.users
on conflict (id) do nothing;
