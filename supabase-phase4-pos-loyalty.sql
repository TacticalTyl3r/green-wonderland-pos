-- Green Wonderland Phase 4: offers, itemized validated checkout, loyalty rewards.
-- Run AFTER Phase 2/3 migrations. Existing sales are preserved.
-- Rewards: 1 point earned per $100 paid on eligible merchandise; 1 point redeems for $1.
-- All prices, discount limits, and balances are validated on the server.
create table if not exists public.gw_pos_offers(
 id bigint generated always as identity primary key,
 title text not null check(length(trim(title)) between 3 and 100),
 offer_type text not null check(offer_type in ('special','bundle')),
 product_id text,
 percent_off numeric(5,2),
 items jsonb not null default '[]'::jsonb,
 bundle_price numeric(12,2),
 begins_at timestamptz,
 ends_at timestamptz,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 check(ends_at is null or begins_at is null or ends_at>begins_at),
 check((offer_type='special' and product_id is not null and percent_off between 0.01 and 100)
    or (offer_type='bundle' and bundle_price>=0 and jsonb_typeof(items)='array'))
);
create table if not exists public.gw_loyalty_members(
 id uuid primary key default gen_random_uuid(),
 member_code text unique not null check(length(trim(member_code)) between 3 and 40),
 display_name text not null check(length(trim(display_name)) between 2 and 100),
 points integer not null default 0 check(points>=0),
 lifetime_earned integer not null default 0 check(lifetime_earned>=0),
 created_at timestamptz not null default now()
);
create table if not exists public.gw_loyalty_ledger(
 id bigint generated always as identity primary key,
 member_id uuid not null references public.gw_loyalty_members(id),
 sale_id uuid references public.gw_sales(id),
 points_delta integer not null,
 note text not null,
 performed_by uuid references public.gw_employees(id),
 created_at timestamptz not null default now(),
 unique(sale_id,points_delta,member_id)
);
create table if not exists public.gw_pos_sale_meta(
 sale_id uuid primary key references public.gw_sales(id),
 member_id uuid references public.gw_loyalty_members(id),
 base_subtotal numeric(12,2) not null,
 offer_discount numeric(12,2) not null,
 manual_discount numeric(12,2) not null,
 reward_discount numeric(12,2) not null,
 delivery_fee numeric(12,2) not null,
 points_earned integer not null default 0,
 points_redeemed integer not null default 0
);
create index if not exists gw_loyalty_ledger_member on public.gw_loyalty_ledger(member_id,created_at desc);
alter table public.gw_pos_offers enable row level security;
alter table public.gw_loyalty_members enable row level security;
alter table public.gw_loyalty_ledger enable row level security;
alter table public.gw_pos_sale_meta enable row level security;
revoke all on public.gw_pos_offers,public.gw_loyalty_members,public.gw_loyalty_ledger,public.gw_pos_sale_meta from public,anon,authenticated;

create or replace function public.gw_pos_active_offers()
returns table(id bigint,title text,offer_type text,product_id text,percent_off numeric,items jsonb,bundle_price numeric,begins_at timestamptz,ends_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
 select o.id,o.title,o.offer_type,o.product_id,o.percent_off,o.items,o.bundle_price,o.begins_at,o.ends_at
 from public.gw_pos_offers o where o.active
 and (o.begins_at is null or o.begins_at<=now())
 and (o.ends_at is null or o.ends_at>now()) order by o.id desc;
$$;

create or replace function public.gw_pos_manage_offers(p_token text,p_id bigint,p_title text,p_type text,
 p_product text,p_percent numeric,p_items jsonb,p_price numeric,p_start timestamptz,p_end timestamptz,p_active boolean)
returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare v_actor uuid;v_id bigint;v_item jsonb;
begin
 v_actor:=public.gw_employee_for_token(p_token);
 if v_actor is null or not exists(select 1 from public.gw_employees where id=v_actor and role='Boss')
 then raise exception 'Boss PIN sign-in required';end if;
 if length(trim(coalesce(p_title,''))) not between 3 and 100 or p_type not in ('special','bundle') then raise exception 'Invalid offer';end if;
 if p_end is not null and p_start is not null and p_end<=p_start then raise exception 'Invalid offer dates';end if;
 if p_type='special' then
  if p_product is null or not exists(select 1 from public.products where id::text=p_product and active) or p_percent<=0 or p_percent>100
  then raise exception 'Choose an active product and discount from 0.01 to 100%';end if;
 else
  if p_price is null or p_price<0 or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 15 then raise exception 'Invalid bundle';end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
   if not exists(select 1 from public.products where id::text=v_item->>'id' and active)
    or coalesce((v_item->>'qty')::integer,0) not between 1 and 50
   then raise exception 'Invalid bundle product or quantity';end if;
  end loop;
 end if;
 if p_id is null then
  insert into public.gw_pos_offers(title,offer_type,product_id,percent_off,items,bundle_price,begins_at,ends_at,active)
  values(trim(p_title),p_type,case when p_type='special' then p_product else null end,
  case when p_type='special' then p_percent else null end,case when p_type='bundle' then p_items else '[]'::jsonb end,
  case when p_type='bundle' then p_price else null end,p_start,p_end,coalesce(p_active,true)) returning id into v_id;
 else
  update public.gw_pos_offers set title=trim(p_title),offer_type=p_type,product_id=case when p_type='special' then p_product else null end,
  percent_off=case when p_type='special' then p_percent else null end,
  items=case when p_type='bundle' then p_items else '[]'::jsonb end,
  bundle_price=case when p_type='bundle' then p_price else null end,begins_at=p_start,ends_at=p_end,active=coalesce(p_active,true)
  where id=p_id returning id into v_id;
  if v_id is null then raise exception 'Offer not found';end if;
 end if;
 return v_id;
end$$;

create or replace function public.gw_pos_all_offers(p_token text)
returns setof public.gw_pos_offers language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from public.gw_employees where id=public.gw_employee_for_token(p_token) and role='Boss')
 then raise exception 'Boss PIN sign-in required';end if;
 return query select * from public.gw_pos_offers order by id desc;
end$$;

create or replace function public.gw_loyalty_find(p_token text,p_code text)
returns table(id uuid,member_code text,display_name text,points integer,lifetime_earned integer)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if public.gw_employee_for_token(p_token) is null then raise exception 'Sign in with employee PIN';end if;
 return query select m.id,m.member_code,m.display_name,m.points,m.lifetime_earned
 from public.gw_loyalty_members m where lower(m.member_code)=lower(trim(p_code)) limit 1;
end$$;
create or replace function public.gw_loyalty_register(p_token text,p_code text,p_name text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_member uuid;
begin
 if public.gw_employee_for_token(p_token) is null then raise exception 'Sign in with employee PIN';end if;
 if trim(coalesce(p_code,'')) !~ '^[a-zA-Z0-9_-]{3,40}$'
 or length(trim(coalesce(p_name,''))) not between 2 and 100
 then raise exception 'Enter a 3-40 character member code and a name';end if;
 insert into public.gw_loyalty_members(member_code,display_name)
 values(trim(p_code),trim(p_name)) returning id into v_member;
 return v_member;
end$$;

create or replace function public.gw_pos_checkout_v4(p_token text,p_employee uuid,
 p_items jsonb,p_fulfillment text,p_zone text,p_manual_percent numeric,
 p_member uuid,p_redeem integer)
returns table(sale_id uuid,total numeric,offer_discount numeric,manual_discount numeric,
 reward_discount numeric,points_earned integer,points_redeemed integer)
language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_employee uuid;v_sale uuid;v_item jsonb;v_product record;v_offer record;v_part jsonb;
 v_qty integer;v_sub numeric:=0;v_off numeric:=0;v_manual numeric:=0;v_reward numeric:=0;
 v_delivery numeric:=0;v_total numeric;v_cap numeric:=100;v_available integer;v_earned integer:=0;
 v_redeem integer:=coalesce(p_redeem,0);v_count integer:=0;v_lines jsonb:='[]'::jsonb;
 v_bundle_gross numeric;v_bundle_copies integer;v_required integer;v_discount numeric;
begin
 v_employee:=coalesce(public.gw_employee_for_token(p_token),p_employee);
 if v_employee is null or not exists(select 1 from public.gw_employees where id=v_employee and active)
 then raise exception 'Select an active employee';end if;
 if p_fulfillment not in ('pickup','delivery') or jsonb_typeof(p_items) is distinct from 'array'
 or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Invalid checkout';end if;
 select max_discount into v_cap from public.app_settings where id=1;
 v_cap:=coalesce(v_cap,100);
 if p_manual_percent is null or p_manual_percent<0 or p_manual_percent>v_cap then raise exception 'Discount exceeds store maximum';end if;
 for v_item in select value from jsonb_array_elements(p_items) loop
  if (v_item->>'qty') !~ '^[0-9]{1,4}$' then raise exception 'Invalid item quantity';end if;
  v_qty:=(v_item->>'qty')::integer;
  if v_qty<1 or v_qty>1000 then raise exception 'Invalid item quantity';end if;
  select p.id::text as id,p.name,p.price into v_product from public.products p
  where p.id::text=v_item->>'id' and p.active;
  if not found then raise exception 'Product unavailable or no longer active';end if;
  v_sub:=v_sub+v_product.price*v_qty;v_count:=v_count+v_qty;
  v_lines:=v_lines||jsonb_build_array(jsonb_build_object('id',v_product.id,'name',v_product.name,
  'qty',v_qty,'choice',left(coalesce(v_item->>'choice',''),120),
  'unit_price',v_product.price,'total',v_product.price*v_qty));
 end loop;
 if v_count>10000 or v_sub>100000000 then raise exception 'Order exceeds limits';end if;
 -- A product special discounts eligible units. Multiple specials use the highest active rate.
 select coalesce(sum((line->>'total')::numeric*
  coalesce((select max(o.percent_off) from public.gw_pos_offers o
   where o.offer_type='special' and o.active and o.product_id=line->>'id'
   and (o.begins_at is null or o.begins_at<=now()) and (o.ends_at is null or o.ends_at>now())),0)/100),0)
 into v_off from jsonb_array_elements(v_lines) line;
 -- Bundles apply to remaining merchandise value, once for each complete matching set.
 -- Discount cannot exceed the original gross bundle value or remaining subtotal.
 for v_offer in select * from public.gw_pos_offers o where o.offer_type='bundle' and o.active
 and (o.begins_at is null or o.begins_at<=now()) and (o.ends_at is null or o.ends_at>now())
 order by id loop
  v_bundle_copies:=2147483647;v_bundle_gross:=0;
  for v_part in select value from jsonb_array_elements(v_offer.items) loop
   v_required:=(v_part->>'qty')::integer;
   select least(v_bundle_copies,coalesce(sum((line->>'qty')::integer),0)/v_required),
    v_bundle_gross+coalesce(max((line->>'unit_price')::numeric),0)*v_required
   into v_bundle_copies,v_bundle_gross
   from jsonb_array_elements(v_lines) line where line->>'id'=v_part->>'id';
  end loop;
  if v_bundle_copies>0 and v_bundle_copies<2147483647 then
   v_discount:=greatest(0,v_bundle_gross-v_offer.bundle_price)*v_bundle_copies;
   v_off:=least(v_sub,v_off+v_discount);
  end if;
 end loop;
 v_off:=least(v_sub,round(v_off,2));
 v_manual:=round((v_sub-v_off)*p_manual_percent/100,2);
 if p_fulfillment='delivery' then
  select fee into v_delivery from public.delivery_zones where id::text=p_zone;
  if not found then raise exception 'Select a valid delivery zone';end if;
 end if;
 v_total:=greatest(0,round(v_sub-v_off-v_manual+v_delivery,2));
 if p_member is not null then
  if public.gw_employee_for_token(p_token) is null then raise exception 'Employee PIN required for loyalty';end if;
  select points into v_available from public.gw_loyalty_members where id=p_member for update;
  if not found then raise exception 'Loyalty member not found';end if;
  if v_redeem<0 or v_redeem>v_available or v_redeem>floor(v_total) then raise exception 'Invalid points redemption';end if;
  v_reward:=v_redeem;v_total:=v_total-v_reward;
  v_earned:=floor(greatest(v_sub-v_off-v_manual-v_reward,0)/100);
 elsif v_redeem<>0 then raise exception 'Choose a member to redeem points';end if;
 v_sale:=public.gw_record_sale(p_token,v_employee,v_total,v_count,p_fulfillment);
 insert into public.gw_sale_receipt_details(sale_id,items) values(v_sale::text,v_lines);
 insert into public.gw_pos_sale_meta(sale_id,member_id,base_subtotal,offer_discount,manual_discount,
 reward_discount,delivery_fee,points_earned,points_redeemed)
 values(v_sale,p_member,v_sub,v_off,v_manual,v_reward,v_delivery,v_earned,v_redeem);
 if p_member is not null then
  update public.gw_loyalty_members set points=points-v_redeem+v_earned,
   lifetime_earned=lifetime_earned+v_earned where id=p_member;
  if v_redeem>0 then insert into public.gw_loyalty_ledger(member_id,sale_id,points_delta,note,performed_by)
   values(p_member,v_sale,-v_redeem,'Redeemed at checkout',v_employee);end if;
  if v_earned>0 then insert into public.gw_loyalty_ledger(member_id,sale_id,points_delta,note,performed_by)
   values(p_member,v_sale,v_earned,'Earned at checkout',v_employee);end if;
 end if;
 return query select v_sale,v_total,v_off,v_manual,v_reward,v_earned,v_redeem;
end$$;

create or replace function public.gw_pos_product_analytics(p_token text)
returns table(product_name text,units bigint,revenue numeric)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.gw_mdt_can(p_token,'sales_earnings') then raise exception 'Access denied';end if;
 return query select (x.item->>'name')::text,
  sum((x.item->>'qty')::bigint),
  round(sum(coalesce((x.item->>'total')::numeric,0)),2)
 from public.gw_sale_receipt_details d
 cross join lateral jsonb_array_elements(d.items) as x(item)
 group by 1 order by 2 desc limit 100;
end$$;

create or replace function public.gw_pos_sale_details(p_token text,p_sale text)
returns table(member_name text,base_subtotal numeric,offer_discount numeric,manual_discount numeric,
 reward_discount numeric,delivery_fee numeric,points_earned integer,points_redeemed integer)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.gw_mdt_can(p_token,'sales_history') then raise exception 'Access denied';end if;
 return query select m.display_name::text,s.base_subtotal,s.offer_discount,s.manual_discount,
 s.reward_discount,s.delivery_fee,s.points_earned,s.points_redeemed
 from public.gw_pos_sale_meta s left join public.gw_loyalty_members m on m.id=s.member_id
 where s.sale_id::text=p_sale;
end$$;

revoke all on function public.gw_pos_active_offers() from public,anon,authenticated;
revoke all on function public.gw_pos_manage_offers(text,bigint,text,text,text,numeric,jsonb,numeric,timestamptz,timestamptz,boolean) from public,anon,authenticated;
revoke all on function public.gw_pos_all_offers(text) from public,anon,authenticated;
revoke all on function public.gw_loyalty_find(text,text) from public,anon,authenticated;
revoke all on function public.gw_loyalty_register(text,text,text) from public,anon,authenticated;
revoke all on function public.gw_pos_checkout_v4(text,uuid,jsonb,text,text,numeric,uuid,integer) from public,anon,authenticated;
revoke all on function public.gw_pos_product_analytics(text) from public,anon,authenticated;
revoke all on function public.gw_pos_sale_details(text,text) from public,anon,authenticated;
grant execute on function public.gw_pos_active_offers() to anon,authenticated;
grant execute on function public.gw_pos_manage_offers(text,bigint,text,text,text,numeric,jsonb,numeric,timestamptz,timestamptz,boolean) to anon,authenticated;
grant execute on function public.gw_pos_all_offers(text) to anon,authenticated;
grant execute on function public.gw_loyalty_find(text,text) to anon,authenticated;
grant execute on function public.gw_loyalty_register(text,text,text) to anon,authenticated;
grant execute on function public.gw_pos_checkout_v4(text,uuid,jsonb,text,text,numeric,uuid,integer) to anon,authenticated;
grant execute on function public.gw_pos_product_analytics(text) to anon,authenticated;
grant execute on function public.gw_pos_sale_details(text,text) to anon,authenticated;

-- Search itemized sales, including their adjustment status, using permission-checked RPC.
create or replace function public.gw_pos_search_sales(p_token text,p_query text default '')
returns table(sale_id text,employee_name text,total numeric,created_at timestamptz,item_count integer,
 fulfillment text,product_names text,adjustment_amount numeric)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.gw_mdt_can(p_token,'sales_history') then raise exception 'Access denied';end if;
 return query
 select s.id::text,e.name::text,s.total,s.created_at,s.item_count,s.fulfillment::text,
 coalesce((select string_agg(distinct x.item->>'name',', ')
 from public.gw_sale_receipt_details d
 cross join lateral jsonb_array_elements(d.items) x(item)
 where d.sale_id=s.id::text),'')::text,
 coalesce((select sum(a.amount) from public.gw_mdt_sale_adjustments a where a.sale_id=s.id::text),0)::numeric
 from public.gw_sales s join public.gw_employees e on e.id=s.employee_id
 where coalesce(trim(p_query),'')=''
 or s.id::text ilike '%'||trim(p_query)||'%'
 or e.name ilike '%'||trim(p_query)||'%'
 or exists(select 1 from public.gw_sale_receipt_details d
 cross join lateral jsonb_array_elements(d.items) x(item)
 where d.sale_id=s.id::text and ((x.item->>'name') ilike '%'||trim(p_query)||'%'
 or (x.item->>'choice') ilike '%'||trim(p_query)||'%'))
 order by s.created_at desc limit 200;
end$$;
revoke all on function public.gw_pos_search_sales(text,text) from public,anon,authenticated;
grant execute on function public.gw_pos_search_sales(text,text) to anon,authenticated;
