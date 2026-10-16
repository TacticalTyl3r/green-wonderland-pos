-- Green Wonderland MDT: sales-history item summaries and Loyalty & Rewards management.
-- Run once after Phase 4 and Customer CID migrations. No existing transactions are modified.
-- All customer data is read through permission-checked RPCs, never public table access.

-- Add specific customer loyalty permissions to the same role matrix as the existing MDT.
alter table public.gw_mdt_role_permissions drop constraint if exists gw_mdt_role_permissions_feature_check;
alter table public.gw_mdt_role_permissions add constraint gw_mdt_role_permissions_feature_check check(feature in
('dashboard','employees','time_management','sales_earnings','admin_catalog','admin_branding',
'employee_add','employee_edit','employee_deactivate','employee_role_assign','employee_pin_reset',
'time_add','time_remove','time_history','sales_history','sales_adjust','announcements','announcements_manage',
'employee_notes','employee_notes_manage','recognition_view','recognition_manage','activity_history',
'offers_manage','loyalty_view','loyalty_adjust'));
insert into public.gw_mdt_role_permissions(role,feature,allowed)
select r.role,f.feature,false
from (values('Manager'),('Senior Salesman'),('Salesman')) r(role)
cross join (values('loyalty_view'),('loyalty_adjust')) f(feature)
on conflict (role,feature) do nothing;

create or replace function public.gw_mdt_sales_items_batch(p_token text,p_sales text[])
returns table(sale_id text,items jsonb)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.gw_mdt_can(p_token,'sales_history') then raise exception 'Sales history access denied';end if;
 if coalesce(array_length(p_sales,1),0)>200 then raise exception 'Too many sales requested';end if;
 return query
 select s.id::text,coalesce(d.items,'[]'::jsonb)
 from public.gw_sales s left join public.gw_sale_receipt_details d on d.sale_id=s.id::text
 where s.id::text=any(coalesce(p_sales,array[]::text[]));
end$$;

create or replace function public.gw_loyalty_members_admin(p_token text,p_query text default '')
returns table(id uuid,member_code text,display_name text,points integer,lifetime_earned integer,
 created_at timestamptz,total_spent numeric,orders bigint)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.gw_mdt_can(p_token,'loyalty_view') and not public.gw_mdt_can(p_token,'loyalty_adjust')
 then raise exception 'Loyalty management access denied';end if;
 return query
 select m.id,m.member_code,m.display_name,m.points,m.lifetime_earned,m.created_at,
 coalesce(sum(s.total),0)::numeric,count(s.id)::bigint
 from public.gw_loyalty_members m
 left join public.gw_pos_sale_meta meta on meta.member_id=m.id
 left join public.gw_sales s on s.id=meta.sale_id
 where coalesce(trim(p_query),'')=''
 or m.member_code ilike '%'||trim(p_query)||'%'
 or m.display_name ilike '%'||trim(p_query)||'%'
 group by m.id,m.member_code,m.display_name,m.points,m.lifetime_earned,m.created_at
 order by m.created_at desc limit 200;
end$$;

create or replace function public.gw_loyalty_member_activity(p_token text,p_member uuid)
returns table(entry_type text,entry_date timestamptz,sale_id text,amount numeric,
 points_delta integer,note text,performed_by text,items jsonb)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.gw_mdt_can(p_token,'loyalty_view') and not public.gw_mdt_can(p_token,'loyalty_adjust')
 then raise exception 'Loyalty management access denied';end if;
 if not exists(select 1 from public.gw_loyalty_members where id=p_member) then raise exception 'Member not found';end if;
 return query
 select 'purchase'::text,s.created_at,s.id::text,s.total::numeric,null::integer,
 ('Purchase · '||s.fulfillment)::text,e.name::text,coalesce(d.items,'[]'::jsonb)
 from public.gw_pos_sale_meta meta
 join public.gw_sales s on s.id=meta.sale_id
 left join public.gw_employees e on e.id=s.employee_id
 left join public.gw_sale_receipt_details d on d.sale_id=s.id::text
 where meta.member_id=p_member
 union all
 select 'points'::text,l.created_at,l.sale_id::text,null::numeric,l.points_delta,l.note,e.name::text,
 '[]'::jsonb
 from public.gw_loyalty_ledger l
 left join public.gw_employees e on e.id=l.performed_by
 where l.member_id=p_member
 order by entry_date desc limit 300;
end$$;

create or replace function public.gw_loyalty_adjust_points(p_token text,p_member uuid,p_delta integer,p_reason text)
returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_actor uuid;v_points integer;
begin
 if not public.gw_mdt_can(p_token,'loyalty_adjust') then raise exception 'Loyalty adjustment access denied';end if;
 v_actor:=public.gw_employee_for_token(p_token);
 if v_actor is null then raise exception 'Sign in with an employee PIN';end if;
 if p_delta is null or p_delta=0 or abs(p_delta)>10000 then raise exception 'Enter a nonzero point adjustment up to 10000';end if;
 if length(trim(coalesce(p_reason,''))) not between 5 and 500 then raise exception 'Reason must be 5 to 500 characters';end if;
 update public.gw_loyalty_members set points=points+p_delta
 where id=p_member returning points into v_points;
 if not found then raise exception 'Loyalty member not found';end if;
 insert into public.gw_loyalty_ledger(member_id,points_delta,note,performed_by)
 values(p_member,p_delta,'Manual adjustment: '||trim(p_reason),v_actor);
 return v_points;
end$$;

revoke all on function public.gw_mdt_sales_items_batch(text,text[]) from public,anon,authenticated;
revoke all on function public.gw_loyalty_members_admin(text,text) from public,anon,authenticated;
revoke all on function public.gw_loyalty_member_activity(text,uuid) from public,anon,authenticated;
revoke all on function public.gw_loyalty_adjust_points(text,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.gw_mdt_sales_items_batch(text,text[]) to anon,authenticated;
grant execute on function public.gw_loyalty_members_admin(text,text) to anon,authenticated;
grant execute on function public.gw_loyalty_member_activity(text,uuid) to anon,authenticated;
grant execute on function public.gw_loyalty_adjust_points(text,uuid,integer,text) to anon,authenticated;
