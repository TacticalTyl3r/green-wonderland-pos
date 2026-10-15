-- Run this in Supabase SQL Editor to repair the existing employee PIN login function.
create or replace function public.gw_pin_login(p_employee uuid,p_pin text,p_token text)
returns table(employee_id uuid,employee_name text,employee_role text)
language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.gw_employees%rowtype; attempt public.gw_pin_attempts%rowtype;
begin
 if p_token is null or length(p_token)<32 or length(p_pin)<4 or length(p_pin)>12 then raise exception 'Invalid credentials'; end if;
 select * into e from public.gw_employees where id=p_employee and active;
 if not found then raise exception 'Invalid credentials'; end if;
 select * into attempt from public.gw_pin_attempts a where a.employee_id=e.id for update;
 if attempt.locked_until>now() then raise exception 'PIN temporarily locked. Try again later'; end if;
 if e.pin_hash<>extensions.crypt(p_pin,e.pin_hash) then
  insert into public.gw_pin_attempts(employee_id,failures,locked_until)
  values(e.id,1,null)
  on conflict(employee_id) do update set failures=case when gw_pin_attempts.locked_until is not null and gw_pin_attempts.locked_until<now() then 1 else gw_pin_attempts.failures+1 end,
   locked_until=case when gw_pin_attempts.failures>=4 then now()+interval '15 minutes' else null end;
  return;
 end if;
 delete from public.gw_pin_attempts a where a.employee_id=e.id;
 delete from public.gw_pin_sessions s where s.employee_id=e.id or s.expires_at<now();
 insert into public.gw_pin_sessions(employee_id,token_hash) values(e.id,encode(extensions.digest(p_token,'sha256'),'hex'));
 return query select e.id,e.name,e.role;
end$$;
