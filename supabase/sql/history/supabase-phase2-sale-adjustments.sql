-- Green Wonderland Phase 2: auditable refunds and voids.
-- Run in Supabase SQL Editor. Original gw_sales rows are never deleted or modified.
alter table public.gw_mdt_role_permissions drop constraint if exists gw_mdt_role_permissions_feature_check;
alter table public.gw_mdt_role_permissions add constraint gw_mdt_role_permissions_feature_check check(feature in
('dashboard','employees','time_management','sales_earnings','admin_catalog','admin_branding',
'employee_add','employee_edit','employee_deactivate','employee_role_assign','employee_pin_reset',
'time_add','time_remove','time_history','sales_history','announcements','announcements_manage',
'employee_notes','employee_notes_manage','recognition_view','recognition_manage','activity_history',
'sales_adjust'));
insert into public.gw_mdt_role_permissions(role,feature,allowed)
select role,'sales_adjust',false from (values('Manager'),('Senior Salesman'),('Salesman')) ranks(role)
on conflict (role,feature) do nothing;

create table if not exists public.gw_mdt_sale_adjustments(
 id bigint generated always as identity primary key,
 sale_id text not null,
 adjustment_type text not null check (adjustment_type in ('refund','void')),
 amount numeric(14,2) not null check(amount>0),
 reason text not null check(length(trim(reason)) between 5 and 1000),
 performed_by text not null,
 created_at timestamptz not null default now()
);
create index if not exists gw_mdt_sale_adjustments_sale_idx on public.gw_mdt_sale_adjustments(sale_id);
alter table public.gw_mdt_sale_adjustments enable row level security;
revoke all on public.gw_mdt_sale_adjustments from public,anon,authenticated;

create or replace function public.gw_mdt_adjustable_sales(p_token text,p_search text default '')
returns table(sale_id text,employee_name text,total numeric,created_at timestamptz,
 item_count integer,fulfillment text,adjusted numeric,remaining numeric)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.gw_mdt_can(p_token,'sales_history') then raise exception 'Access denied'; end if;
 return query
 select s.id::text,e.name::text,s.total::numeric,s.created_at,
 s.item_count::integer,s.fulfillment::text,
 coalesce(a.adjusted,0)::numeric,(s.total-coalesce(a.adjusted,0))::numeric
 from public.gw_sales s
 join public.gw_employees e on e.id=s.employee_id
 left join lateral (
  select sum(x.amount) adjusted from public.gw_mdt_sale_adjustments x where x.sale_id=s.id::text
 ) a on true
 where coalesce(p_search,'')='' or e.name ilike '%'||p_search||'%'
    or s.id::text ilike '%'||p_search||'%'
 order by s.created_at desc limit 150;
end$$;

create or replace function public.gw_mdt_adjust_sale(
 p_token text,p_sale text,p_type text,p_amount numeric,p_reason text
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_total numeric;v_used numeric;v_actor text;
begin
 if not public.gw_mdt_can(p_token,'sales_adjust') then raise exception 'Access denied'; end if;
 if p_type not in ('refund','void') then raise exception 'Invalid adjustment type'; end if;
 if length(trim(coalesce(p_reason,''))) not between 5 and 1000 then raise exception 'Reason must be 5-1000 characters'; end if;
 select s.total into v_total from public.gw_sales s where s.id::text=p_sale for update;
 if not found then raise exception 'Sale not found'; end if;
 select coalesce(sum(a.amount),0) into v_used from public.gw_mdt_sale_adjustments a where a.sale_id=p_sale;
 if v_total<=v_used then raise exception 'Sale already fully adjusted'; end if;
 if p_amount is null or p_amount<=0 or round(p_amount,2)<>p_amount
    or p_amount>v_total-v_used then raise exception 'Invalid adjustment amount'; end if;
 if p_type='void' and p_amount<>v_total-v_used then raise exception 'Void must cover the entire remaining balance'; end if;
 v_actor:=public.gw_mdt_actor_name(p_token);
 if v_actor is null then raise exception 'Unknown actor'; end if;
 insert into public.gw_mdt_sale_adjustments(sale_id,adjustment_type,amount,reason,performed_by)
 values(p_sale,p_type,p_amount,trim(p_reason),v_actor);
end$$;

create or replace function public.gw_mdt_sale_adjustments_list(p_token text)
returns table(sale_id text,adjustment_type text,amount numeric,reason text,
 performed_by text,created_at timestamptz)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.gw_mdt_can(p_token,'sales_history') then raise exception 'Access denied'; end if;
 return query select a.sale_id,a.adjustment_type,a.amount,a.reason,
 a.performed_by,a.created_at from public.gw_mdt_sale_adjustments a
 order by a.created_at desc limit 500;
end$$;

revoke all on function public.gw_mdt_adjustable_sales(text,text) from public,anon,authenticated;
revoke all on function public.gw_mdt_adjust_sale(text,text,text,numeric,text) from public,anon,authenticated;
revoke all on function public.gw_mdt_sale_adjustments_list(text) from public,anon,authenticated;
grant execute on function public.gw_mdt_adjustable_sales(text,text) to anon,authenticated;
grant execute on function public.gw_mdt_adjust_sale(text,text,text,numeric,text) to anon,authenticated;
grant execute on function public.gw_mdt_sale_adjustments_list(text) to anon,authenticated;

-- Refund totals are reported by adjustment date, not by the original sale date.
create or replace function public.gw_mdt_sale_adjustment_totals(p_token text)
returns table(today_adjustments numeric,weekly_adjustments numeric,lifetime_adjustments numeric)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.gw_mdt_can(p_token,'sales_earnings') then raise exception 'Access denied'; end if;
 return query
 select coalesce(sum(a.amount) filter(where a.created_at >= date_trunc('day',now())),0)::numeric,
 coalesce(sum(a.amount) filter(where a.created_at >= date_trunc('week',now())),0)::numeric,
 coalesce(sum(a.amount),0)::numeric from public.gw_mdt_sale_adjustments a;
end$$;
revoke all on function public.gw_mdt_sale_adjustment_totals(text) from public,anon,authenticated;
grant execute on function public.gw_mdt_sale_adjustment_totals(text) to anon,authenticated;
