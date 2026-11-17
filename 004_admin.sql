-- Migration 004: Admin OS foundations (roles, suspension, settings, audit log). Run after 001-003. Safe to re-run.
alter table public.profiles add column if not exists is_suspended boolean not null default false;
alter table public.contents add column if not exists admin_feedback text;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and not is_suspended);
$$;
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','moderator') and not is_suspended);
$$;

-- Role / suspension can be changed only by an admin (SQL editor, auth.uid() null, is still allowed for first-admin setup)
create or replace function public.protect_profile_role() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role; new.is_suspended := old.is_suspended;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop policy if exists "profiles_staff_read" on public.profiles;
create policy "profiles_staff_read" on public.profiles for select to authenticated using (public.is_staff());
drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Contents: staff can insert/update, only admins can delete; suspended users cannot submit
drop policy if exists "contents_staff_all" on public.contents;
drop policy if exists "contents_staff_insert" on public.contents;
create policy "contents_staff_insert" on public.contents for insert to authenticated with check (public.is_staff());
drop policy if exists "contents_staff_update" on public.contents;
create policy "contents_staff_update" on public.contents for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "contents_admin_delete" on public.contents;
create policy "contents_admin_delete" on public.contents for delete to authenticated using (public.is_admin());
drop policy if exists "contents_insert_own" on public.contents;
create policy "contents_insert_own" on public.contents for insert to authenticated
  with check (author_id = auth.uid() and status in ('draft','pending')
    and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_suspended));

-- Site settings (watermark, social links ...). Public read, admin write.
create table if not exists public.site_settings (
  key text primary key check (char_length(key) <= 50),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.site_settings enable row level security;
drop policy if exists "settings_read" on public.site_settings;
create policy "settings_read" on public.site_settings for select using (true);
drop policy if exists "settings_admin_write" on public.site_settings;
create policy "settings_admin_write" on public.site_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
insert into public.site_settings (key, value) values
  ('watermark', '{"enabled": true, "position": "br", "opacity": 0.5}'),
  ('social', '[]')
on conflict (key) do nothing;

-- Audit log: written only by triggers, readable only by admins, never editable from the client
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  action text not null,
  table_name text not null,
  row_id text,
  details jsonb
);
alter table public.audit_logs enable row level security;
drop policy if exists "audit_admin_read" on public.audit_logs;
create policy "audit_admin_read" on public.audit_logs for select to authenticated using (public.is_admin());

create or replace function public.audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
declare n jsonb; o jsonb; rid text; det jsonb;
begin
  n := case when TG_OP = 'DELETE' then null else to_jsonb(NEW) end;
  o := case when TG_OP = 'INSERT' then null else to_jsonb(OLD) end;
  rid := coalesce(n->>'id', n->>'key', o->>'id', o->>'key');
  if TG_OP = 'UPDATE' then
    det := jsonb_build_object('changed', (select coalesce(jsonb_agg(k), '[]'::jsonb) from jsonb_object_keys(n) k where n->k is distinct from o->k and k not in ('updated_at')),
      'old_status', o->>'status', 'new_status', n->>'status', 'old_role', o->>'role', 'new_role', n->>'role');
  elsif TG_OP = 'DELETE' then det := jsonb_build_object('title', o->>'title', 'status', o->>'status');
  else det := jsonb_build_object('title', n->>'title', 'status', n->>'status'); end if;
  insert into public.audit_logs (actor, action, table_name, row_id, details) values (auth.uid(), TG_OP, TG_TABLE_NAME, rid, det);
  return coalesce(NEW, OLD);
end $$;

drop trigger if exists audit_contents_ins on public.contents;
create trigger audit_contents_ins after insert on public.contents for each row execute function public.audit_trigger();
drop trigger if exists audit_contents_upd on public.contents;
create trigger audit_contents_upd after update on public.contents for each row
  when (old.status is distinct from new.status or old.title is distinct from new.title or old.body is distinct from new.body or old.featured is distinct from new.featured)
  execute function public.audit_trigger();
drop trigger if exists audit_contents_del on public.contents;
create trigger audit_contents_del after delete on public.contents for each row execute function public.audit_trigger();
drop trigger if exists audit_profiles_upd on public.profiles;
create trigger audit_profiles_upd after update on public.profiles for each row
  when (old.role is distinct from new.role or old.is_suspended is distinct from new.is_suspended)
  execute function public.audit_trigger();
drop trigger if exists audit_settings_all on public.site_settings;
create trigger audit_settings_all after insert or update or delete on public.site_settings for each row execute function public.audit_trigger();

-- First admin (run once in SQL editor, replace the email):
-- update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');
