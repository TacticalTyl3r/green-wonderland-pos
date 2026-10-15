-- Green Wonderland MDT: sales history, announcements and private management notes.
-- Run in Supabase SQL Editor. Does not change inventory or POS sale behavior.
insert into public.gw_mdt_role_permissions(role,feature,allowed)
select roles.role,features.feature,false
from (values ('Manager'),('Senior Salesman'),('Salesman')) roles(role)
cross join (values ('sales_history'),('announcements'),('announcements_manage'),('employee_notes'),('employee_notes_manage')) features(feature)
on conflict (role,feature) do nothing;

create table if not exists public.gw_mdt_announcements(
 id bigint generated always as identity primary key,
 title text not null check(length(trim(title)) between 3 and 120),
 body text not null check(length(trim(body)) between 3 and 4000),
 author text not null,
 created_at timestamptz not null default now()
);
create table if not exists public.gw_mdt_employee_notes(
 id bigint generated always as identity primary key,
 employee_id uuid not null references public.gw_employees(id),
 category text not null check(category in ('General','Recognition','Disciplinary')),
 body text not null check(length(trim(body)) between 3 and 3000),
 author text not null,
 created_at timestamptz not null default now()
);
alter table public.gw_mdt_announcements enable row level security;
alter table public.gw_mdt_employee_notes enable row level security;
revoke all on public.gw_mdt_announcements,public.gw_mdt_employee_notes from public,anon,authenticated;

create or replace function public.gw_mdt_actor_name(p_token text)
returns text language sql stable security definer set search_path=public,pg_temp as $$
 select case when public.gw_is_boss() then 'Boss'
 else (select name from public.gw_employees where id=public.gw_employee_for_token(p_token)) end
$$;
revoke all on function public.gw_mdt_actor_name(text) from public,anon,authenticated;

create or replace function public.gw_mdt_announcements_list(p_token text)
returns table(id bigint,title text,body text,author text,created_at timestamptz)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.gw_mdt_can(p_token,'announcements') and not public.gw_mdt_can(p_token,'announcements_manage') then raise exception 'Access denied'; end if;
 return query select a.id,a.title,a.body,a.author,a.created_at from public.gw_mdt_announcements a order by a.created_at desc limit 100;
end$$;

create or replace function public.gw_mdt_announcement_create(p_token text,p_title text,p_body text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.gw_mdt_can(p_token,'announcements_manage') then raise exception 'Access denied'; end if;
 insert into public.gw_mdt_announcements(title,body,author) values(trim(p_title),trim(p_body),public.gw_mdt_actor_name(p_token));
end$$;

create or replace function public.gw_mdt_announcement_delete(p_token text,p_id bigint)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.gw_mdt_can(p_token,'announcements_manage') then raise exception 'Access denied'; end if;
 delete from public.gw_mdt_announcements where id=p_id;
end$$;

create or replace function public.gw_mdt_notes_list(p_token text,p_employee uuid)
returns table(id bigint,category text,body text,author text,created_at timestamptz)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.gw_mdt_can(p_token,'employee_notes') and not public.gw_mdt_can(p_token,'employee_notes_manage') then raise exception 'Access denied'; end if;
 return query select n.id,n.category,n.body,n.author,n.created_at from public.gw_mdt_employee_notes n where n.employee_id=p_employee order by n.created_at desc limit 100;
end$$;

create or replace function public.gw_mdt_note_create(p_token text,p_employee uuid,p_category text,p_body text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.gw_mdt_can(p_token,'employee_notes_manage') then raise exception 'Access denied'; end if;
 insert into public.gw_mdt_employee_notes(employee_id,category,body,author)
 values(p_employee,p_category,trim(p_body),public.gw_mdt_actor_name(p_token));
end$$;

create or replace function public.gw_mdt_sales_history(p_token text,p_from timestamptz default null,p_to timestamptz default null,p_employee uuid default null)
returns table(employee_name text,total numeric,item_count integer,fulfillment text,created_at timestamptz)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.gw_mdt_can(p_token,'sales_history') then raise exception 'Access denied'; end if;
 return query
 select e.name,s.total,s.item_count,s.fulfillment,s.created_at
 from public.gw_sales s join public.gw_employees e on e.id=s.employee_id
 where (p_from is null or s.created_at>=p_from)
 and (p_to is null or s.created_at<p_to)
 and (p_employee is null or s.employee_id=p_employee)
 order by s.created_at desc limit 1000;
end$$;

revoke all on function public.gw_mdt_announcements_list(text),public.gw_mdt_announcement_create(text,text,text),
public.gw_mdt_announcement_delete(text,bigint),public.gw_mdt_notes_list(text,uuid),
public.gw_mdt_note_create(text,uuid,text,text),public.gw_mdt_sales_history(text,timestamptz,timestamptz,uuid)
from public,anon,authenticated;
grant execute on function public.gw_mdt_announcements_list(text),public.gw_mdt_announcement_create(text,text,text),
public.gw_mdt_announcement_delete(text,bigint),public.gw_mdt_notes_list(text,uuid),
public.gw_mdt_note_create(text,uuid,text,text),public.gw_mdt_sales_history(text,timestamptz,timestamptz,uuid)
to anon,authenticated;
