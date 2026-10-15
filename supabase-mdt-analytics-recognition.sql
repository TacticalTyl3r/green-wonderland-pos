-- Green Wonderland MDT: analytics, recognition, and searchable management activity.
-- Apply in Supabase SQL Editor after earlier MDT migrations.
alter table public.gw_mdt_role_permissions drop constraint if exists gw_mdt_role_permissions_feature_check;
alter table public.gw_mdt_role_permissions add constraint gw_mdt_role_permissions_feature_check check(feature in
('dashboard','employees','time_management','sales_earnings','admin_catalog','admin_branding','employee_add','employee_edit','employee_deactivate','employee_role_assign','employee_pin_reset','time_add','time_remove','time_history','sales_history','announcements','announcements_manage','employee_notes','employee_notes_manage','recognition_view','recognition_manage','activity_history'));
insert into public.gw_mdt_role_permissions(role,feature,allowed)
select r.role,f.feature,false from (values('Manager'),('Senior Salesman'),('Salesman')) r(role)
cross join (values('recognition_view'),('recognition_manage'),('activity_history')) f(feature)
on conflict(role,feature) do nothing;

create table if not exists public.gw_mdt_recognition(
 id bigint generated always as identity primary key,
 employee_id uuid not null references public.gw_employees(id),
 award text not null check(length(trim(award)) between 3 and 100),
 note text not null check(length(trim(note)) between 3 and 1500),
 awarded_by text not null,
 created_at timestamptz not null default now()
);
alter table public.gw_mdt_recognition enable row level security;
revoke all on public.gw_mdt_recognition from public,anon,authenticated;

create or replace function public.gw_mdt_recognition_list(p_token text,p_employee uuid default null)
returns table(id bigint,employee_id uuid,employee_name text,award text,note text,awarded_by text,created_at timestamptz)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.gw_mdt_can(p_token,'recognition_view') and not public.gw_mdt_can(p_token,'recognition_manage') then raise exception 'Access denied'; end if;
 return query select r.id,r.employee_id,e.name,r.award,r.note,r.awarded_by,r.created_at
 from public.gw_mdt_recognition r join public.gw_employees e on e.id=r.employee_id
 where p_employee is null or r.employee_id=p_employee order by r.created_at desc limit 200;
end$$;

create or replace function public.gw_mdt_recognition_add(p_token text,p_employee uuid,p_award text,p_note text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.gw_mdt_can(p_token,'recognition_manage') then raise exception 'Access denied'; end if;
 insert into public.gw_mdt_recognition(employee_id,award,note,awarded_by)
 values(p_employee,trim(p_award),trim(p_note),public.gw_mdt_actor_name(p_token));
end$$;

create or replace function public.gw_mdt_sales_trends(p_token text,p_from timestamptz,p_to timestamptz)
returns table(day date,sales numeric,orders bigint)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.gw_mdt_can(p_token,'sales_earnings') then raise exception 'Access denied'; end if;
 if p_from is null or p_to is null or p_to<=p_from or p_to>p_from+interval '370 days' then raise exception 'Invalid date range'; end if;
 return query select (s.created_at at time zone 'UTC')::date,coalesce(sum(s.total),0)::numeric,count(*)::bigint
 from public.gw_sales s where s.created_at>=p_from and s.created_at<p_to
 group by 1 order by 1;
end$$;

create or replace function public.gw_mdt_activity_search(p_token text,p_search text default '',p_from timestamptz default null,p_to timestamptz default null)
returns table(action text,subject text,details text,actor text,created_at timestamptz)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.gw_mdt_can(p_token,'activity_history') then raise exception 'Access denied'; end if;
 return query select a.action,a.subject,a.details,a.actor,a.created_at from public.gw_mdt_activity_log a
 where (p_from is null or a.created_at>=p_from) and (p_to is null or a.created_at<p_to)
 and (coalesce(p_search,'')='' or concat_ws(' ',a.action,a.subject,a.actor,a.details) ilike '%'||replace(replace(p_search,'%','\\%'),'_','\\_')||'%' escape '\\')
 order by a.created_at desc limit 500;
end$$;
revoke all on function public.gw_mdt_recognition_list(text,uuid),public.gw_mdt_recognition_add(text,uuid,text,text),public.gw_mdt_sales_trends(text,timestamptz,timestamptz),public.gw_mdt_activity_search(text,text,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.gw_mdt_recognition_list(text,uuid),public.gw_mdt_recognition_add(text,uuid,text,text),public.gw_mdt_sales_trends(text,timestamptz,timestamptz),public.gw_mdt_activity_search(text,text,timestamptz,timestamptz) to anon,authenticated;
