-- OPTIONAL but recommended: make the DATABASE itself require MFA (aal2) for admin/staff powers.
-- !! Run ONLY AFTER you have enrolled an authenticator app in Admin -> Settings and confirmed you can log in with it.
-- Otherwise you will lock yourself out of admin features (fix: run 004_admin.sql again to restore the old functions).
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and not is_suspended);
$$;
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     and exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','moderator') and not is_suspended);
$$;
