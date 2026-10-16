-- Green Wonderland: Checkout integrity security hardening.
-- Run in Supabase SQL Editor AFTER existing Phase 4 SQL.
-- Previously the anonymous API could submit arbitrary sale totals through legacy RPCs.
-- All new transactions now require a verified employee PIN and server-calculated prices.
-- Does not delete or rewrite historical sales.

-- New verified checkout always calculates item costs and discounts from database tables.
create or replace function public.gw_pos_checkout_v4(p_token text,p_employee uuid,
 p_items jsonb,p_fulfillment text,p_zone text,p_manual_percent numeric,
 p_member uuid,p_redeem integer,p_expected_total numeric)
returns table(sale_id uuid,total numeric,offer_discount numeric,manual_discount numeric,
 reward_discount numeric,points_earned integer,points_redeemed integer)
language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_employee uuid;v_sale uuid;v_item jsonb;v_product record;v_offer record;v_part jsonb;
 v_qty integer;v_sub numeric:=0;v_off numeric:=0;v_manual numeric:=0;v_reward numeric:=0;
 v_delivery numeric:=0;v_total numeric;v_cap numeric:=100;v_available integer;v_earned integer:=0;
 v_redeem integer:=coalesce(p_redeem,0);v_count integer:=0;v_lines jsonb:='[]'::jsonb;
 v_bundle_gross numeric;v_bundle_copies integer;v_required integer;v_discount numeric;v_best_bundle numeric:=0;
begin
 v_employee:=public.gw_employee_for_token(p_token);
 if v_employee is null then raise exception 'Sign in with an active employee PIN before checkout';end if;
 if p_employee is not null and p_employee<>v_employee then
  raise exception 'Sale employee does not match the signed-in employee';
 end if;
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
 select coalesce(sum((line.value->>'total')::numeric*
  coalesce((select max(o.percent_off) from public.gw_pos_offers o
   where o.offer_type='special' and o.active and o.product_id=line.value->>'id'
   and (o.begins_at is null or o.begins_at<=now()) and (o.ends_at is null or o.ends_at>now())),0)/100),0)
 into v_off from jsonb_array_elements(v_lines) AS line(value);
 -- Bundles apply to remaining merchandise value, once for each complete matching set.
 -- Discount cannot exceed the original gross bundle value or remaining subtotal.
 for v_offer in select * from public.gw_pos_offers o where o.offer_type='bundle' and o.active
 and (o.begins_at is null or o.begins_at<=now()) and (o.ends_at is null or o.ends_at>now())
 order by id loop
  v_bundle_copies:=2147483647;v_bundle_gross:=0;
  for v_part in select value from jsonb_array_elements(v_offer.items) loop
   v_required:=(v_part->>'qty')::integer;
   select least(v_bundle_copies,coalesce(sum((line.value->>'qty')::integer),0)/v_required),
    v_bundle_gross+coalesce(max((line.value->>'unit_price')::numeric),0)*v_required
   into v_bundle_copies,v_bundle_gross
   from jsonb_array_elements(v_lines) AS line(value) where line.value->>'id'=v_part->>'id';
  end loop;
  if v_bundle_copies>0 and v_bundle_copies<2147483647 then
   v_discount:=greatest(0,v_bundle_gross-v_offer.bundle_price)*v_bundle_copies;
   v_best_bundle:=greatest(v_best_bundle,v_discount);
  end if;
 end loop;
 -- Apply the strongest savings path rather than stacking overlapping bundle and special offers.
 v_off:=least(v_sub,round(greatest(v_off,v_best_bundle),2));
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
  if v_redeem<0 or v_redeem>greatest(0,v_available) or v_redeem>floor(v_total) then raise exception 'Invalid points redemption';end if;
  v_reward:=v_redeem;v_total:=v_total-v_reward;
  v_earned:=floor(greatest(v_sub-v_off-v_manual-v_reward,0)/100);
 elsif v_redeem<>0 then raise exception 'Choose a member to redeem points';end if;
 if p_expected_total is null or abs(round(p_expected_total,2)-v_total)>0.01 then
  raise exception 'Checkout total changed. Refresh the POS and confirm the updated price.';
 end if;
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

-- Disable old client-priced sale recording paths, which allowed arbitrary totals.
-- SECURITY DEFINER checkout can still invoke gw_record_sale internally.
revoke all on function public.gw_record_sale(text,uuid,numeric,integer,text)
 from public,anon,authenticated;
revoke all on function public.gw_record_sale_detailed(text,uuid,numeric,integer,text,jsonb)
 from public,anon,authenticated;

-- Preserve only the server-calculated checkout as an externally callable sale writer.
revoke all on function public.gw_pos_checkout_v4(text,uuid,jsonb,text,text,numeric,uuid,integer,numeric)
 from public,anon,authenticated;
grant execute on function public.gw_pos_checkout_v4(text,uuid,jsonb,text,text,numeric,uuid,integer,numeric)
 to anon,authenticated;

-- Read-only audit check: expect only the validated checkout to be granted to anon/authenticated.
select p.proname as function_name,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_can_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_can_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
 ('gw_record_sale','gw_record_sale_detailed','gw_pos_checkout_v4')
order by p.proname;
