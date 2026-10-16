-- Green Wonderland: catalog reward redemption.
-- Separate from cash checkout, with atomic points deduction and an audit record.
-- Requires the previously installed loyalty Boss configuration migration.
begin;
do $$
declare v_table regclass;
begin
 select c.oid into v_table from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relname=any(array['gw_loyalty_members','gw_loyalty_customers','loyalty_members'])
 and c.relkind in ('r','p')
 and exists(select 1 from pg_attribute a where a.attrelid=c.oid and a.attname='id' and a.atttypid='uuid'::regtype)
 and exists(select 1 from pg_attribute a where a.attrelid=c.oid and a.attname='points' and a.atttypid in ('integer'::regtype,'bigint'::regtype,'numeric'::regtype))
 order by case c.relname when 'gw_loyalty_members' then 1 when 'gw_loyalty_customers' then 2 else 3 end limit 1;
 if v_table is null then raise exception 'Loyalty customer table not recognized. No changes made; please share the SQL definition of gw_loyalty_find.';end if;
 execute format('create or replace function public.gw_pos_reward_debit_member(p_member uuid,p_points integer) returns integer language plpgsql security definer set search_path=public,pg_temp as $body$ declare v_remaining integer; begin update %s set points=points-p_points where id=p_member and points>=p_points returning points::integer into v_remaining; if v_remaining is null then raise exception ''Member not found or insufficient points'';end if; return v_remaining; end $body$',v_table);
end $$;
revoke all on function public.gw_pos_reward_debit_member(uuid,integer) from public,anon,authenticated;
create table if not exists public.gw_loyalty_catalog_redemptions(
 id uuid primary key default gen_random_uuid(),
 member_id uuid not null,
 reward_id uuid not null references public.gw_loyalty_rewards(id),
 reward_title text not null,
 points_spent integer not null check(points_spent>0),
 points_remaining integer not null,
 employee_id uuid not null,
 created_at timestamptz not null default now()
);
create index if not exists gw_catalog_redemptions_member_date on public.gw_loyalty_catalog_redemptions(member_id,created_at desc);
alter table public.gw_loyalty_catalog_redemptions enable row level security;
revoke all on public.gw_loyalty_catalog_redemptions from anon,authenticated;
create or replace function public.gw_pos_catalog_rewards(p_token text)
returns table(id uuid,title text,description text,points_cost integer)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if public.gw_employee_for_token(p_token) is null then raise exception 'Employee PIN sign-in required';end if;
 return query select r.id,r.title,r.description,r.points_cost from public.gw_loyalty_rewards r where r.active order by r.points_cost,r.title;
end $$;
create or replace function public.gw_pos_redeem_catalog_reward(p_token text,p_member uuid,p_reward uuid)
returns table(reward_title text,points_spent integer,points_remaining integer,redemption_id uuid)
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_employee uuid; v_title text; v_cost integer; v_remaining integer; v_id uuid;
begin
 v_employee:=public.gw_employee_for_token(p_token);
 if v_employee is null then raise exception 'Employee PIN sign-in required';end if;
 if p_member is null or p_reward is null then raise exception 'Choose a member and a reward';end if;
 select r.title,r.points_cost into v_title,v_cost
 from public.gw_loyalty_rewards r where r.id=p_reward and r.active for share;
 if not found then raise exception 'Reward no longer available';end if;
 -- One statement prevents overspending even when two employees redeem at once.
 v_remaining:=public.gw_pos_reward_debit_member(p_member,v_cost);
 insert into public.gw_loyalty_catalog_redemptions(member_id,reward_id,reward_title,points_spent,points_remaining,employee_id)
 values(p_member,p_reward,v_title,v_cost,v_remaining,v_employee) returning id into v_id;
 return query select v_title,v_cost,v_remaining,v_id;
end $$;
create or replace function public.gw_pos_catalog_reward_history(p_token text,p_member uuid)
returns table(redemption_id uuid,reward_title text,points_spent integer,points_remaining integer,created_at timestamptz,employee_name text)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.gw_mdt_can(p_token,'loyalty_view') and not public.gw_mdt_can(p_token,'loyalty_adjust')
 then raise exception 'Loyalty access denied';end if;
 return query
 select r.id,r.reward_title,r.points_spent,r.points_remaining,r.created_at,
 coalesce(e.name,'Unknown employee')::text
 from public.gw_loyalty_catalog_redemptions r left join public.gw_employees e on e.id=r.employee_id
 where r.member_id=p_member order by r.created_at desc limit 200;
end $$;
revoke all on function public.gw_pos_catalog_rewards(text) from public;
revoke all on function public.gw_pos_redeem_catalog_reward(text,uuid,uuid) from public;
revoke all on function public.gw_pos_catalog_reward_history(text,uuid) from public;
grant execute on function public.gw_pos_catalog_rewards(text) to anon,authenticated;
grant execute on function public.gw_pos_redeem_catalog_reward(text,uuid,uuid) to anon,authenticated;
grant execute on function public.gw_pos_catalog_reward_history(text,uuid) to anon,authenticated;
commit;
