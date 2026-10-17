-- Phase 3: Boss-only employee PIN session security center.
-- Requires existing supabase-employees.sql objects.
-- No PINs, session tokens or token hashes are exposed by these RPCs.
create table if not exists public.gw_security_events(
 id bigint generated always as identity primary key,
 actor_employee uuid references public.gw_employees(id),
 target_employee uuid references public.gw_employees(id),
 event_type text not null check(event_type in ('session_revoked','all_sessions_revoked','pin_lock_reset')),
 details text not null default '',
 created_at timestamptz not null default now()
);
alter table public.gw_security_events enable row level security;
revoke all on public.gw_security_events from public,anon,authenticated;

create or replace function public.gw_security_overview(p_token text)
returns table(employee_id uuid,employee_name text,employee_role text,session_id uuid,
 session_created_at timestamptz,session_expires_at timestamptz,failed_attempts integer,
 locked_until timestamptz)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_actor uuid;
begin
 v_actor:=public.gw_employee_for_token(p_token);
 if v_actor is null or not exists(select 1 from public.gw_employees where id=v_actor and role='Boss')
 then raise exception 'Boss employee PIN session required';end if;
 return query
 select e.id,e.name,e.role,s.id,s.created_at,s.expires_at,coalesce(a.failures,0),a.locked_until
 from public.gw_employees e
 left join public.gw_pin_sessions s on s.employee_id=e.id and s.expires_at>now()
 left join public.gw_pin_attempts a on a.employee_id=e.id
 order by e.name,s.created_at desc;
end$$;

create or replace function public.gw_security_revoke_session(p_token text,p_session uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_actor uuid;v_target uuid;
begin
 v_actor:=public.gw_employee_for_token(p_token);
 if v_actor is null or not exists(select 1 from public.gw_employees where id=v_actor and role='Boss')
 then raise exception 'Boss employee PIN session required';end if;
 select employee_id into v_target from public.gw_pin_sessions where id=p_session;
 if v_target is null then raise exception 'Session not found or already expired';end if;
 delete from public.gw_pin_sessions where id=p_session;
 insert into public.gw_security_events(actor_employee,target_employee,event_type,details)
 values(v_actor,v_target,'session_revoked','Revoked a PIN session');
end$$;

create or replace function public.gw_security_revoke_employee(p_token text,p_employee uuid)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare v_actor uuid;v_count integer;
begin
 v_actor:=public.gw_employee_for_token(p_token);
 if v_actor is null or not exists(select 1 from public.gw_employees where id=v_actor and role='Boss')
 then raise exception 'Boss employee PIN session required';end if;
 if not exists(select 1 from public.gw_employees where id=p_employee) then raise exception 'Employee not found';end if;
 delete from public.gw_pin_sessions where employee_id=p_employee;
 get diagnostics v_count=row_count;
 insert into public.gw_security_events(actor_employee,target_employee,event_type,details)
 values(v_actor,p_employee,'all_sessions_revoked','Revoked '||v_count||' PIN sessions');
 return v_count;
end$$;

create or replace function public.gw_security_reset_pin_lock(p_token text,p_employee uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_actor uuid;
begin
 v_actor:=public.gw_employee_for_token(p_token);
 if v_actor is null or not exists(select 1 from public.gw_employees where id=v_actor and role='Boss')
 then raise exception 'Boss employee PIN session required';end if;
 if not exists(select 1 from public.gw_employees where id=p_employee) then raise exception 'Employee not found';end if;
 update public.gw_pin_attempts set failures=0,locked_until=null where employee_id=p_employee;
 insert into public.gw_security_events(actor_employee,target_employee,event_type,details)
 values(v_actor,p_employee,'pin_lock_reset','Reset failed PIN counter and lockout');
end$$;

create or replace function public.gw_security_events_list(p_token text)
returns table(actor_name text,target_name text,event_type text,details text,created_at timestamptz)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_actor uuid;
begin
 v_actor:=public.gw_employee_for_token(p_token);
 if v_actor is null or not exists(select 1 from public.gw_employees where id=v_actor and role='Boss')
 then raise exception 'Boss employee PIN session required';end if;
 return query select a.name::text,t.name::text,s.event_type,s.details,s.created_at
 from public.gw_security_events s
 left join public.gw_employees a on a.id=s.actor_employee
 left join public.gw_employees t on t.id=s.target_employee
 order by s.created_at desc limit 200;
end$$;
revoke all on function public.gw_security_overview(text) from public,anon,authenticated;
revoke all on function public.gw_security_revoke_session(text,uuid) from public,anon,authenticated;
revoke all on function public.gw_security_revoke_employee(text,uuid) from public,anon,authenticated;
revoke all on function public.gw_security_reset_pin_lock(text,uuid) from public,anon,authenticated;
revoke all on function public.gw_security_events_list(text) from public,anon,authenticated;
grant execute on function public.gw_security_overview(text) to anon,authenticated;
grant execute on function public.gw_security_revoke_session(text,uuid) to anon,authenticated;
grant execute on function public.gw_security_revoke_employee(text,uuid) to anon,authenticated;
grant execute on function public.gw_security_reset_pin_lock(text,uuid) to anon,authenticated;
grant execute on function public.gw_security_events_list(text) to anon,authenticated;
