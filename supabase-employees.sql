-- Green Wonderland employee PIN, shift tracking and auditable time adjustments.
-- Requires supabase-role-permissions.sql and an existing Boss Supabase Auth account.
create extension if not exists pgcrypto;
create table if not exists public.gw_employees(
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 2 and 100),
 role text not null default 'Salesman' check(role in ('Boss','Manager','Senior Salesman','Salesman')),
 pin_hash text not null,
 active boolean not null default true,
 hired_at timestamptz not null default now(),
 created_at timestamptz not null default now()
);
create unique index if not exists gw_employee_name_ci on public.gw_employees(lower(name));
create table if not exists public.gw_pin_attempts(employee_id uuid primary key references public.gw_employees(id) on delete cascade, failures integer not null default 0, locked_until timestamptz);\ncreate table if not exists public.gw_pin_sessions(
 id uuid primary key default gen_random_uuid(),
 employee_id uuid not null references public.gw_employees(id),
 token_hash text not null unique,
 expires_at timestamptz not null default (now()+interval '12 hours'),
 created_at timestamptz not null default now()
);
create table if not exists public.gw_shifts(
 id uuid primary key default gen_random_uuid(),
 employee_id uuid not null references public.gw_employees(id),
 clock_in timestamptz not null default now(),
 clock_out timestamptz,
 check(clock_out is null or clock_out>=clock_in)
);
create unique index if not exists gw_one_open_shift on public.gw_shifts(employee_id) where clock_out is null;
create table if not exists public.gw_time_adjustments(
 id uuid primary key default gen_random_uuid(),
 employee_id uuid not null references public.gw_employees(id),
 minutes integer not null check(minutes between -10080 and 10080 and minutes<>0),
 reason text not null check(length(trim(reason)) between 5 and 500),
 actor_user_id uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create table if not exists public.gw_sales(
 id uuid primary key default gen_random_uuid(),
 employee_id uuid references public.gw_employees(id),
 attribution text not null check(attribution in ('verified','selected')),
 total numeric(12,2) not null check(total>=0),
 item_count integer not null check(item_count>0),
 fulfillment text not null check(fulfillment in ('pickup','delivery')),
 created_at timestamptz not null default now()
);
alter table public.gw_employees enable row level security;
alter table public.gw_pin_attempts enable row level security;\nalter table public.gw_pin_sessions enable row level security;
alter table public.gw_shifts enable row level security;
alter table public.gw_time_adjustments enable row level security;
alter table public.gw_sales enable row level security;
-- No direct table grants for anonymous users; all sensitive actions use RPC.
revoke all on public.gw_employees,public.gw_pin_attempts,public.gw_pin_sessions,public.gw_shifts,public.gw_time_adjustments,public.gw_sales from anon,authenticated;
create or replace function public.gw_employee_for_token(p_token text)
returns uuid language sql stable security definer set search_path=public,pg_temp
as $$select s.employee_id from public.gw_pin_sessions s join public.gw_employees e on e.id=s.employee_id
where s.token_hash=encode(digest(p_token,'sha256'),'hex') and s.expires_at>now() and e.active limit 1$$;
revoke all on function public.gw_employee_for_token(text) from public;
create or replace function public.gw_public_employees()
returns table(id uuid,name text) language sql stable security definer set search_path=public,pg_temp
as $$select e.id,e.name from public.gw_employees e where e.active order by e.name$$;
create or replace function public.gw_pin_login(p_employee uuid,p_pin text,p_token text)
returns table(employee_id uuid,employee_name text,employee_role text)
language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.gw_employees%rowtype; attempt public.gw_pin_attempts%rowtype;
begin
 if p_token is null or length(p_token)<32 or length(p_pin)<4 or length(p_pin)>12 then raise exception 'Invalid credentials'; end if;
 select * into e from public.gw_employees where id=p_employee and active;
 if not found then raise exception 'Invalid credentials'; end if;
 select * into attempt from public.gw_pin_attempts where employee_id=e.id for update;
 if attempt.locked_until>now() then raise exception 'PIN temporarily locked. Try again later'; end if;
 if e.pin_hash<>crypt(p_pin,e.pin_hash) then
  insert into public.gw_pin_attempts(employee_id,failures,locked_until)
  values(e.id,1,null)
  on conflict(employee_id) do update set failures=case when gw_pin_attempts.locked_until<now() then 1 else gw_pin_attempts.failures+1 end,
   locked_until=case when gw_pin_attempts.failures>=4 then now()+interval '15 minutes' else null end;
  return;
 end if;
 delete from public.gw_pin_attempts where employee_id=e.id;
 delete from public.gw_pin_sessions where employee_id=e.id or expires_at<now();
 insert into public.gw_pin_sessions(employee_id,token_hash) values(e.id,encode(digest(p_token,'sha256'),'hex'));
 return query select e.id,e.name,e.role;
end$$;
create or replace function public.gw_pin_me(p_token text)
returns table(employee_id uuid,employee_name text,employee_role text,clocked_in boolean)
language sql stable security definer set search_path=public,pg_temp as $$
select e.id,e.name,e.role,exists(select 1 from public.gw_shifts s where s.employee_id=e.id and s.clock_out is null)
from public.gw_employees e where e.id=public.gw_employee_for_token(p_token)$$;
create or replace function public.gw_pin_logout(p_token text)
returns void language sql security definer set search_path=public,pg_temp as $$
delete from public.gw_pin_sessions where token_hash=encode(digest(p_token,'sha256'),'hex')$$;
create or replace function public.gw_clock(p_token text,p_clock_in boolean)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare eid uuid:=public.gw_employee_for_token(p_token);
begin
 if eid is null then raise exception 'Session expired. Sign in again'; end if;
 if p_clock_in then
  if exists(select 1 from public.gw_shifts where employee_id=eid and clock_out is null) then raise exception 'Already clocked in'; end if;
  insert into public.gw_shifts(employee_id) values(eid);return 'Clocked in';
 else
  update public.gw_shifts set clock_out=now() where employee_id=eid and clock_out is null;
  if not found then raise exception 'No open shift'; end if;return 'Clocked out';
 end if;
end$$;
create or replace function public.gw_manage_employee(p_id uuid,p_name text,p_role text,p_pin text,p_active boolean)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid;
begin
 if not public.gw_is_boss() then raise exception 'Boss access required'; end if;
 if length(trim(p_name))<2 or p_role not in ('Boss','Manager','Senior Salesman','Salesman') then raise exception 'Invalid employee'; end if;
 if p_pin is not null and (p_pin !~ '^[0-9]{4,12}$') then raise exception 'PIN must be 4 to 12 digits'; end if;
 if p_id is null then
  if p_pin is null then raise exception 'PIN required'; end if;
  insert into public.gw_employees(name,role,pin_hash,active) values(trim(p_name),p_role,crypt(p_pin,gen_salt('bf',12)),p_active) returning id into result;
 else
  update public.gw_employees set name=trim(p_name),role=p_role,active=p_active,
   pin_hash=case when p_pin is null then pin_hash else crypt(p_pin,gen_salt('bf',12)) end where id=p_id returning id into result;
  if result is null then raise exception 'Employee not found'; end if;
  if p_pin is not null or not p_active then delete from public.gw_pin_sessions where employee_id=result; end if;
 end if;
 return result;
end$$;
create or replace function public.gw_adjust_time(p_employee uuid,p_minutes integer,p_reason text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.gw_is_boss() then raise exception 'Boss access required'; end if;
 insert into public.gw_time_adjustments(employee_id,minutes,reason,actor_user_id)
 values(p_employee,p_minutes,trim(p_reason),auth.uid());
end$$;
create or replace function public.gw_staff_report()
returns table(id uuid,name text,role text,active boolean,worked_minutes numeric,adjusted_minutes bigint,clocked_in boolean)
language sql stable security definer set search_path=public,pg_temp as $$
select e.id,e.name,e.role,e.active,
 coalesce((select sum(extract(epoch from (coalesce(s.clock_out,now())-s.clock_in))/60) from public.gw_shifts s where s.employee_id=e.id),0),
 coalesce((select sum(a.minutes) from public.gw_time_adjustments a where a.employee_id=e.id),0),
 exists(select 1 from public.gw_shifts s where s.employee_id=e.id and s.clock_out is null)
from public.gw_employees e where public.gw_is_boss() order by e.name$$;
-- Sales are recorded as estimates from browser checkout; selected attribution is NOT authenticated.
create or replace function public.gw_record_sale(p_token text,p_employee uuid,p_total numeric,p_count integer,p_fulfillment text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare verified uuid:=public.gw_employee_for_token(p_token); result uuid;
begin
 if p_total<0 or p_total>100000000 or p_count<1 or p_count>10000 or p_fulfillment not in ('pickup','delivery') then raise exception 'Invalid sale'; end if;
 if verified is null and not exists(select 1 from public.gw_employees where id=p_employee and active) then raise exception 'Select an active employee'; end if;
 insert into public.gw_sales(employee_id,attribution,total,item_count,fulfillment)
 values(coalesce(verified,p_employee),case when verified is null then 'selected' else 'verified' end,p_total,p_count,p_fulfillment)
 returning id into result;return result;
end$$;
-- Prevent privilege escalation through direct grants. Only callable RPCs are exposed.
grant execute on function public.gw_public_employees() to anon,authenticated;
grant execute on function public.gw_pin_login(uuid,text,text) to anon,authenticated;
grant execute on function public.gw_pin_me(text) to anon,authenticated;
grant execute on function public.gw_pin_logout(text) to anon,authenticated;
grant execute on function public.gw_clock(text,boolean) to anon,authenticated;
grant execute on function public.gw_record_sale(text,uuid,numeric,integer,text) to anon,authenticated;
grant execute on function public.gw_manage_employee(uuid,text,text,text,boolean) to authenticated;
grant execute on function public.gw_adjust_time(uuid,integer,text) to authenticated;
grant execute on function public.gw_staff_report() to authenticated;
-- Restrict function access for unauthenticated roles where appropriate.
revoke all on function public.gw_manage_employee(uuid,text,text,text,boolean),public.gw_adjust_time(uuid,integer,text),public.gw_staff_report() from public,anon;
-- Failed PINs return no rows (rather than raising) so lockout counters commit.\n-- IMPORTANT: Also configure API rate limits / edge throttling for PIN attempts.
-- Do not rely on 4-digit PINs alone for internet-facing accounts.
