-- Green Wonderland loyalty configuration and rewards catalog
-- Additive migration: does not change existing member balances or checkout.
create table if not exists public.gw_loyalty_config (
 id integer primary key default 1 check(id=1),
 earn_per_amount numeric(12,2) not null default 100 check(earn_per_amount>0),
 point_value numeric(12,2) not null default 1 check(point_value>0),
 enabled boolean not null default true,
 updated_at timestamptz not null default now(),
 updated_by uuid
);
insert into public.gw_loyalty_config(id) values(1) on conflict(id) do nothing;
alter table public.gw_loyalty_config enable row level security;
revoke all on public.gw_loyalty_config from anon,authenticated;
create table if not exists public.gw_loyalty_rewards (
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(trim(title)) between 3 and 100),
 description text not null default '',
 points_cost integer not null check(points_cost between 1 and 100000),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.gw_loyalty_rewards enable row level security;
revoke all on public.gw_loyalty_rewards from anon,authenticated;
create or replace function public.gw_loyalty_is_boss(p_token text)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.gw_employees e
 where e.id=public.gw_employee_for_token(p_token) and lower(e.role)='boss' and e.active=true);
$$;
create or replace function public.gw_loyalty_settings(p_token text)
returns table(earn_per_amount numeric,point_value numeric,enabled boolean)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.gw_mdt_can(p_token,'loyalty_view') and not public.gw_mdt_can(p_token,'loyalty_adjust')
 then raise exception 'Loyalty access denied';end if;
 return query select c.earn_per_amount,c.point_value,c.enabled from public.gw_loyalty_config c where c.id=1;
end $$;
create or replace function public.gw_loyalty_save_settings(p_token text,p_earn_per_amount numeric,p_point_value numeric,p_enabled boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.gw_loyalty_is_boss(p_token) then raise exception 'Boss access required';end if;
 if p_earn_per_amount is null or p_earn_per_amount<1 or p_earn_per_amount>1000000
 or p_point_value is null or p_point_value<=0 or p_point_value>10000
 or p_enabled is null then raise exception 'Invalid loyalty settings';end if;
 update public.gw_loyalty_config set earn_per_amount=p_earn_per_amount,point_value=p_point_value,
 enabled=p_enabled,updated_at=now(),updated_by=public.gw_employee_for_token(p_token) where id=1;
end $$;
create or replace function public.gw_loyalty_rewards_list(p_token text)
returns table(id uuid,title text,description text,points_cost integer,active boolean)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.gw_mdt_can(p_token,'loyalty_view') and not public.gw_mdt_can(p_token,'loyalty_adjust')
 then raise exception 'Loyalty access denied';end if;
 return query select r.id,r.title,r.description,r.points_cost,r.active from public.gw_loyalty_rewards r order by r.active desc,r.points_cost,r.title;
end $$;
create or replace function public.gw_loyalty_reward_save(p_token text,p_id uuid,p_title text,p_description text,p_points_cost integer,p_active boolean)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
 if not public.gw_loyalty_is_boss(p_token) then raise exception 'Boss access required';end if;
 if length(trim(coalesce(p_title,''))) not between 3 and 100 or length(coalesce(p_description,''))>1000
 or p_points_cost is null or p_points_cost not between 1 and 100000 or p_active is null
 then raise exception 'Invalid reward';end if;
 if p_id is null then
 insert into public.gw_loyalty_rewards(title,description,points_cost,active)
 values(trim(p_title),trim(coalesce(p_description,'')),p_points_cost,p_active) returning id into v_id;
 else
 update public.gw_loyalty_rewards set title=trim(p_title),description=trim(coalesce(p_description,'')),
 points_cost=p_points_cost,active=p_active,updated_at=now() where id=p_id returning id into v_id;
 if v_id is null then raise exception 'Reward not found';end if;
 end if;
 return v_id;
end $$;
revoke all on function public.gw_loyalty_is_boss(text) from public;
grant execute on function public.gw_loyalty_is_boss(text) to authenticated,anon;
grant execute on function public.gw_loyalty_settings(text) to authenticated,anon;
grant execute on function public.gw_loyalty_save_settings(text,numeric,numeric,boolean) to authenticated,anon;
grant execute on function public.gw_loyalty_rewards_list(text) to authenticated,anon;
grant execute on function public.gw_loyalty_reward_save(text,uuid,text,text,integer,boolean) to authenticated,anon;
