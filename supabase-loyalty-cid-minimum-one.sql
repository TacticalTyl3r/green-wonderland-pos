-- Allow one-character Customer CIDs. Run once in Supabase SQL Editor.
-- Existing loyalty accounts and points are preserved.
alter table public.gw_loyalty_members
 drop constraint if exists gw_loyalty_members_member_code_check;
alter table public.gw_loyalty_members
 add constraint gw_loyalty_members_member_code_check
 check(length(trim(member_code)) between 1 and 40);

create or replace function public.gw_loyalty_register(p_token text,p_code text,p_name text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_member uuid;
begin
 if public.gw_employee_for_token(p_token) is null then
  raise exception 'Sign in with employee PIN';
 end if;
 if length(trim(coalesce(p_code,''))) not between 1 and 40
    or trim(coalesce(p_code,'')) ~ '[^a-zA-Z0-9_-]'
    or length(trim(coalesce(p_name,''))) not between 2 and 100 then
  raise exception 'Enter a 1-40 character Customer CID and a name';
 end if;
 insert into public.gw_loyalty_members(member_code,display_name)
 values(trim(p_code),trim(p_name)) returning id into v_member;
 return v_member;
end$$;
