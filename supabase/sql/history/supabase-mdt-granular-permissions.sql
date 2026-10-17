-- Green Wonderland MDT: granular employee and time-management permissions
-- Run this migration BEFORE deploying frontend controls.
-- No existing employee, shift, sales or adjustment records are deleted.
-- Existing Boss-only RPCs remain unchanged; new RPCs enforce each permission.

alter table public.gw_mdt_role_permissions
  drop constraint if exists gw_mdt_role_permissions_feature_check;
alter table public.gw_mdt_role_permissions
  add constraint gw_mdt_role_permissions_feature_check
  check (feature in (
    'dashboard','employees','time_management','sales_earnings',
    'admin_catalog','admin_branding',
    'employee_add','employee_edit','employee_deactivate',
    'employee_role_assign','employee_pin_reset',
    'time_add','time_remove','time_history'
  ));

insert into public.gw_mdt_role_permissions(role,feature,allowed)
select r.role,f.feature,false
from (values ('Manager'),('Senior Salesman'),('Salesman')) r(role)
cross join (values
 ('employee_add'),('employee_edit'),('employee_deactivate'),
 ('employee_role_assign'),('employee_pin_reset'),
 ('time_add'),('time_remove'),('time_history')
) f(feature)
on conflict(role,feature) do nothing;

-- Ensure Boss may edit the expanded permission set.
create or replace function public.gw_mdt_set_role_permission(
 p_role text,p_feature text,p_allowed boolean
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.gw_is_boss() then raise exception 'Boss access required'; end if;
 if p_role not in ('Manager','Senior Salesman','Salesman')
    or p_feature not in (
     'dashboard','employees','time_management','sales_earnings',
     'admin_catalog','admin_branding',
     'employee_add','employee_edit','employee_deactivate',
     'employee_role_assign','employee_pin_reset',
     'time_add','time_remove','time_history')
    or p_allowed is null then raise exception 'Invalid permission'; end if;
 insert into public.gw_mdt_role_permissions(role,feature,allowed,updated_at)
 values(p_role,p_feature,p_allowed,now())
 on conflict(role,feature) do update
 set allowed=excluded.allowed,updated_at=now();
end$$;

-- Security-definer helper, not exposed to client roles.
create or replace function public.gw_mdt_can(p_token text,p_feature text)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(public.gw_is_boss(),false) or exists (
  select 1 from public.gw_employees e
  where e.id=public.gw_employee_for_token(p_token) and e.active and e.role='Boss'
 ) or exists (
  select 1 from public.gw_employees e
  join public.gw_mdt_role_permissions p on p.role=e.role
  where e.id=public.gw_employee_for_token(p_token) and e.active
    and p.feature=p_feature and p.allowed
 )
$$;
revoke all on function public.gw_mdt_can(text,text) from public,anon,authenticated;

-- Do not allow lower roles to create or edit Boss accounts, grant Boss,
-- or promote anyone to a role equal/higher than their own.
-- Separate permission required for changing roles or resetting PINs.
create or replace function public.gw_mdt_manage_employee(
 p_token text,p_id uuid,p_name text,p_role text,p_pin text,p_active boolean
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
 actor_id uuid:=public.gw_employee_for_token(p_token);
 actor_role text;
 old_employee public.gw_employees%rowtype;
 result_id uuid;
 actor_rank integer;
 target_rank integer;
begin
 if public.gw_is_boss() then
  return public.gw_manage_employee(p_id,p_name,p_role,p_pin,p_active);
 end if;
 if actor_id is null then raise exception 'Employee PIN session required'; end if;
 select e.role into actor_role from public.gw_employees e where e.id=actor_id and e.active;
 actor_rank:=case actor_role when 'Manager' then 3 when 'Senior Salesman' then 2 when 'Salesman' then 1 else 0 end;
 target_rank:=case p_role when 'Manager' then 3 when 'Senior Salesman' then 2 when 'Salesman' then 1 else 99 end;
 if p_role='Boss' or target_rank>=actor_rank then raise exception 'Cannot manage this role'; end if;
 if p_name is null or length(trim(p_name)) not between 2 and 100
    or p_active is null then raise exception 'Invalid employee'; end if;
 if p_pin is not null and p_pin !~ '^[0-9]{4,12}$' then raise exception 'PIN must be 4-12 digits'; end if;
 if p_id is null then
  if not public.gw_mdt_can(p_token,'employee_add') then raise exception 'Add employee permission required'; end if;
  if p_pin is null then raise exception 'PIN required'; end if;
  insert into public.gw_employees(name,role,pin_hash,active)
  values(trim(p_name),p_role,extensions.crypt(p_pin,extensions.gen_salt('bf',12)),p_active)
  returning id into result_id;
 else
  select * into old_employee from public.gw_employees where id=p_id for update;
  if not found then raise exception 'Employee not found'; end if;
  if old_employee.role='Boss'
    or (case old_employee.role when 'Manager' then 3 when 'Senior Salesman' then 2 when 'Salesman' then 1 else 99 end)>=actor_rank
    or old_employee.id=actor_id then raise exception 'Cannot modify this employee'; end if;
  if p_name is distinct from old_employee.name and not public.gw_mdt_can(p_token,'employee_edit') then
    raise exception 'Edit employee permission required'; end if;
  if p_role is distinct from old_employee.role and not public.gw_mdt_can(p_token,'employee_role_assign') then
    raise exception 'Assign role permission required'; end if;
  if p_active is distinct from old_employee.active and not public.gw_mdt_can(p_token,'employee_deactivate') then
    raise exception 'Employee status permission required'; end if;
  if p_pin is not null and not public.gw_mdt_can(p_token,'employee_pin_reset') then
    raise exception 'Reset PIN permission required'; end if;
  update public.gw_employees set name=trim(p_name),role=p_role,active=p_active,
   pin_hash=case when p_pin is null then pin_hash else extensions.crypt(p_pin,extensions.gen_salt('bf',12)) end
  where id=p_id returning id into result_id;
  if p_pin is not null or not p_active or p_role is distinct from old_employee.role then
   delete from public.gw_pin_sessions where employee_id=p_id;
  end if;
 end if;
 return result_id;
end$$;

-- Audit PIN-based time adjustments separately because the original
-- gw_time_adjustments.actor_user_id requires a Supabase Auth user.
create table if not exists public.gw_mdt_time_audit(
 id uuid primary key default gen_random_uuid(),
 employee_id uuid not null references public.gw_employees(id),
 actor_employee_id uuid references public.gw_employees(id),
 actor_user_id uuid references auth.users(id),
 minutes integer not null check(minutes between -10080 and 10080 and minutes<>0),
 reason text not null check(length(trim(reason)) between 5 and 500),
 created_at timestamptz not null default now(),
 check(actor_employee_id is not null or actor_user_id is not null)
);
alter table public.gw_mdt_time_audit enable row level security;
revoke all on public.gw_mdt_time_audit from public,anon,authenticated;

create or replace function public.gw_mdt_adjust_time(
 p_token text,p_employee uuid,p_minutes integer,p_reason text
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare actor_id uuid:=public.gw_employee_for_token(p_token);
begin
 if p_minutes is null or p_minutes=0 or abs(p_minutes)>10080
    or p_reason is null or length(trim(p_reason)) not between 5 and 500 then
  raise exception 'Invalid adjustment or reason'; end if;
 if not exists(select 1 from public.gw_employees where id=p_employee) then
  raise exception 'Employee not found'; end if;
 if public.gw_is_boss() then
  insert into public.gw_mdt_time_audit(employee_id,actor_user_id,minutes,reason)
  values(p_employee,auth.uid(),p_minutes,trim(p_reason));
 else
  if actor_id is null or not public.gw_mdt_can(p_token,case when p_minutes>0 then 'time_add' else 'time_remove' end) then
   raise exception 'Time adjustment permission required'; end if;
  if p_employee=actor_id then raise exception 'Cannot adjust your own time'; end if;
  if exists(select 1 from public.gw_employees where id=p_employee and role='Boss') then
   raise exception 'Cannot adjust Boss time'; end if;
  insert into public.gw_mdt_time_audit(employee_id,actor_employee_id,minutes,reason)
  values(p_employee,actor_id,p_minutes,trim(p_reason));
 end if;
end$$;

-- Report sums original and newly delegated adjustments.
create or replace function public.gw_mdt_staff_report(
 p_token text,p_feature text
) returns table(id uuid,name text,role text,active boolean,worked_minutes numeric,adjusted_minutes bigint,clocked_in boolean)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if p_feature not in ('dashboard','employees','time_management')
    or not public.gw_mdt_can(p_token,p_feature) then raise exception 'Access denied'; end if;
 return query
 select e.id,e.name,e.role,e.active,
  coalesce((select sum(extract(epoch from (coalesce(s.clock_out,now())-s.clock_in))/60) from public.gw_shifts s where s.employee_id=e.id),0)::numeric,
  (coalesce((select sum(a.minutes) from public.gw_time_adjustments a where a.employee_id=e.id),0)
   +coalesce((select sum(a.minutes) from public.gw_mdt_time_audit a where a.employee_id=e.id),0))::bigint,
  exists(select 1 from public.gw_shifts s where s.employee_id=e.id and s.clock_out is null)
 from public.gw_employees e order by e.name;
end$$;

-- Time audit can be viewed by Boss or roles with time_history.
create or replace function public.gw_mdt_time_history(p_token text)
returns table(employee_name text,actor_name text,minutes integer,reason text,created_at timestamptz)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.gw_mdt_can(p_token,'time_history') then raise exception 'Access denied'; end if;
 return query
 select e.name,coalesce(ae.name,'Boss'),a.minutes,a.reason,a.created_at
 from public.gw_mdt_time_audit a
 join public.gw_employees e on e.id=a.employee_id
 left join public.gw_employees ae on ae.id=a.actor_employee_id
 order by a.created_at desc limit 500;
end$$;

revoke all on function public.gw_mdt_manage_employee(text,uuid,text,text,text,boolean),
 public.gw_mdt_adjust_time(text,uuid,integer,text),
 public.gw_mdt_time_history(text) from public,anon,authenticated;
grant execute on function public.gw_mdt_manage_employee(text,uuid,text,text,text,boolean),
 public.gw_mdt_adjust_time(text,uuid,integer,text),
 public.gw_mdt_time_history(text) to anon,authenticated;
