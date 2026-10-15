-- Green Wonderland MDT management activity audit (run once in Supabase SQL Editor).
-- Append-only; existing records are preserved.
create table if not exists public.gw_mdt_activity_log(
 id bigint generated always as identity primary key,
 action text not null,
 subject text not null,
 details text,
 actor text not null default 'System / administrative session',
 created_at timestamptz not null default now()
);
alter table public.gw_mdt_activity_log enable row level security;
revoke all on public.gw_mdt_activity_log from public,anon,authenticated;

create or replace function public.gw_mdt_employee_activity_trigger()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into public.gw_mdt_activity_log(action,subject,details)
 values(
  case when tg_op='INSERT' then 'Employee created' else 'Employee updated' end,
  new.name,
  case when tg_op='INSERT' then 'Position: '||new.role
       else concat_ws('; ',
        case when new.role is distinct from old.role then 'Position: '||old.role||' -> '||new.role end,
        case when new.active is distinct from old.active then 'Active: '||old.active||' -> '||new.active end,
        case when new.name is distinct from old.name then 'Name changed' end,
        case when new.pin_hash is distinct from old.pin_hash then 'PIN reset' end)
  end
 );
 return new;
end$$;
drop trigger if exists gw_mdt_employee_activity on public.gw_employees;
create trigger gw_mdt_employee_activity after insert or update on public.gw_employees
for each row execute function public.gw_mdt_employee_activity_trigger();

create or replace function public.gw_mdt_permission_activity_trigger()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='UPDATE' and new.allowed is not distinct from old.allowed then return new; end if;
 insert into public.gw_mdt_activity_log(action,subject,details)
 values('Permission changed',new.role,new.feature||': '||case when new.allowed then 'Enabled' else 'Disabled' end);
 return new;
end$$;
drop trigger if exists gw_mdt_permission_activity on public.gw_mdt_role_permissions;
create trigger gw_mdt_permission_activity after insert or update on public.gw_mdt_role_permissions
for each row execute function public.gw_mdt_permission_activity_trigger();

create or replace function public.gw_mdt_activity_report(p_token text)
returns table(action text,subject text,details text,actor text,created_at timestamptz)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.gw_mdt_can(p_token,'dashboard') then raise exception 'Dashboard permission required'; end if;
 return query select a.action,a.subject,a.details,a.actor,a.created_at
 from public.gw_mdt_activity_log a order by a.created_at desc limit 100;
end$$;
revoke all on function public.gw_mdt_activity_report(text) from public,anon,authenticated;
grant execute on function public.gw_mdt_activity_report(text) to anon,authenticated;
