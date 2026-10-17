-- Green Wonderland MDT: employee role permissions (phase 1)
-- Run in Supabase SQL Editor. Existing Boss account remains the sole administrator.
-- IMPORTANT: These grants do not bypass existing Boss-only RPC checks.
create table if not exists public.gw_mdt_role_permissions (
 role text not null check (role in ('Manager','Senior Salesman','Salesman')),
 feature text not null check (feature in ('dashboard','employees','time_management','sales_earnings','admin_catalog','admin_branding')),
 allowed boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key (role,feature)
);
alter table public.gw_mdt_role_permissions enable row level security;
revoke all on public.gw_mdt_role_permissions from public,anon,authenticated;
insert into public.gw_mdt_role_permissions(role,feature,allowed)
select r.role,f.feature,
 case when r.role='Manager' and f.feature in ('dashboard','employees','time_management','sales_earnings') then true
      when r.role='Senior Salesman' and f.feature in ('dashboard','sales_earnings') then true
      else false end
from (values ('Manager'),('Senior Salesman'),('Salesman')) as r(role)
cross join (values ('dashboard'),('employees'),('time_management'),('sales_earnings'),('admin_catalog'),('admin_branding')) as f(feature)
on conflict (role,feature) do nothing;

-- Caller may read permissions only for their own active PIN session,
-- or as a Supabase Auth Boss. Never trust a role passed from the browser.
create or replace function public.gw_mdt_my_permissions(p_token text)
returns table(feature text,allowed boolean)
language sql stable security definer set search_path=public,pg_temp
as $$
 with identity as (
  select e.role from public.gw_employees e
  where e.id=public.gw_employee_for_token(p_token) and e.active
 )
 select p.feature,
 case when (select role from identity)='Boss' then true else p.allowed end
 from public.gw_mdt_role_permissions p
 where p.role=(select role from identity)
 union all
 select f.feature,true
 from (values ('dashboard'),('employees'),('time_management'),('sales_earnings'),('admin_catalog'),('admin_branding')) as f(feature)
 where (select role from identity)='Boss'
$$;

create or replace function public.gw_mdt_role_permissions_admin()
returns table(role text,feature text,allowed boolean)
language plpgsql stable security definer set search_path=public,pg_temp
as $$
begin
 if not public.gw_is_boss() then raise exception 'Boss access required'; end if;
 return query select p.role,p.feature,p.allowed from public.gw_mdt_role_permissions p order by p.role,p.feature;
end$$;

create or replace function public.gw_mdt_set_role_permission(p_role text,p_feature text,p_allowed boolean)
returns void language plpgsql security definer set search_path=public,pg_temp
as $$
begin
 if not public.gw_is_boss() then raise exception 'Boss access required'; end if;
 if p_role not in ('Manager','Senior Salesman','Salesman')
    or p_feature not in ('dashboard','employees','time_management','sales_earnings','admin_catalog','admin_branding')
    or p_allowed is null then raise exception 'Invalid permission'; end if;
 insert into public.gw_mdt_role_permissions(role,feature,allowed,updated_at)
 values(p_role,p_feature,p_allowed,now())
 on conflict(role,feature) do update set allowed=excluded.allowed,updated_at=now();
end$$;
revoke all on function public.gw_mdt_my_permissions(text),
 public.gw_mdt_role_permissions_admin(),
 public.gw_mdt_set_role_permission(text,text,boolean) from public,anon,authenticated;
grant execute on function public.gw_mdt_my_permissions(text) to anon,authenticated;
grant execute on function public.gw_mdt_role_permissions_admin() to authenticated;
grant execute on function public.gw_mdt_set_role_permission(text,text,boolean) to authenticated;
