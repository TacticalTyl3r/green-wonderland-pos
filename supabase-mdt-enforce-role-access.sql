-- Green Wonderland MDT phase 2: enforce role permissions at the database boundary.
-- Run in Supabase SQL Editor BEFORE deploying the accompanying website update.
-- Boss Supabase Auth keeps full access. Employee PIN sessions authorize only the
-- exact features granted to their current role, checked on every RPC call.
-- No role or employee id supplied by a client is trusted for authorization.

create or replace function public.gw_mdt_can(p_token text,p_feature text)
returns boolean language sql stable security definer set search_path=public,pg_temp
as $$
 select coalesce(public.gw_is_boss(),false) or exists (
   select 1 from public.gw_employees e
   join public.gw_mdt_role_permissions p on p.role=e.role
   where e.id=public.gw_employee_for_token(p_token)
     and e.active and p.feature=p_feature and p.allowed
 ) or exists (
   select 1 from public.gw_employees e
   where e.id=public.gw_employee_for_token(p_token) and e.active and e.role='Boss'
 )
$$;
revoke all on function public.gw_mdt_can(text,text) from public,anon,authenticated;

-- Read-only staff report for authorized Dashboard / Employees / Time Management.
-- Employee edits and time adjustments remain Boss-only until separately delegated.
create or replace function public.gw_mdt_staff_report(p_token text,p_feature text)
returns table(id uuid,name text,role text,active boolean,worked_minutes numeric,adjusted_minutes bigint,clocked_in boolean)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if p_feature not in ('dashboard','employees','time_management')
    or not public.gw_mdt_can(p_token,p_feature) then
   raise exception 'Access denied';
 end if;
 return query
 select e.id,e.name,e.role,e.active,
   coalesce((select sum(extract(epoch from (coalesce(s.clock_out,now())-s.clock_in))/60) from public.gw_shifts s where s.employee_id=e.id),0)::numeric,
   coalesce((select sum(a.minutes) from public.gw_time_adjustments a where a.employee_id=e.id),0)::bigint,
   exists(select 1 from public.gw_shifts s where s.employee_id=e.id and s.clock_out is null)
 from public.gw_employees e order by e.name;
end$$;

-- Read-only sales/earnings report for authorized roles.
create or replace function public.gw_mdt_sales_report_for_role(p_token text)
returns table(employee_id uuid,employee_name text,employee_role text,today_sales numeric,weekly_sales numeric,lifetime_sales numeric,total_orders bigint)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.gw_mdt_can(p_token,'sales_earnings') then raise exception 'Access denied'; end if;
 return query
 select e.id,e.name,e.role,
 coalesce(sum(s.total) filter (where s.created_at>=date_trunc('day',now())),0)::numeric,
 coalesce(sum(s.total) filter (where s.created_at>=date_trunc('week',now())),0)::numeric,
 coalesce(sum(s.total),0)::numeric,
 count(s.id)::bigint
 from public.gw_employees e
 left join public.gw_sales s on s.employee_id=e.id
 group by e.id,e.name,e.role
 order by coalesce(sum(s.total),0) desc,e.name;
end$$;

revoke all on function public.gw_mdt_staff_report(text,text),
 public.gw_mdt_sales_report_for_role(text) from public,anon,authenticated;
grant execute on function public.gw_mdt_staff_report(text,text),
 public.gw_mdt_sales_report_for_role(text) to anon,authenticated;

-- Never grant write access to raw tables. Boss retains the existing
-- gw_manage_employee, gw_adjust_time and role permission editor controls.
