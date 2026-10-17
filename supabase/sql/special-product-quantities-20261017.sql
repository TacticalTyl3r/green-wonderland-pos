-- Green Wonderland POS: quantity-aware Product Specials (applied 2026-10-17).
-- Supabase migration name: special_product_quantities_20261017.
-- This file captures deployed function definitions for review and future setup.
-- Quantities of 1 preserve prior behavior; quantities >1 discount only complete
-- groups of matching products, across cart variants of the same catalog ID.
-- NEVER run historical files as a batch or reapply without checking production.

CREATE OR REPLACE FUNCTION public.gw_pos_checkout_v4(p_token text, p_employee uuid, p_items jsonb, p_fulfillment text, p_zone text, p_manual_percent numeric, p_member uuid, p_redeem integer, p_expected_total numeric)
 RETURNS TABLE(sale_id uuid, total numeric, offer_discount numeric, manual_discount numeric, reward_discount numeric, points_earned integer, points_redeemed integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
 -- Specials: each configured product quantity forms the unit threshold.
 -- Only complete groups receive a discount (e.g. 3 purchased, 2 required = 2 discounted).
 -- Existing specials that require 1 still discount every purchased unit.
 with catalog_units as (
  select line.value->>'id' as id,
         sum((line.value->>'qty')::integer)::integer as units,
         max((line.value->>'unit_price')::numeric) as unit_price
  from jsonb_array_elements(v_lines) AS line(value)
  group by line.value->>'id'
 )
 select coalesce(sum(g.unit_price * coalesce((
    select max(floor(g.units::numeric / req.required_qty) * req.required_qty * o.percent_off / 100)
    from public.gw_pos_offers o
    cross join lateral (
      select coalesce(
        (select greatest(1,(i.value->>'qty')::integer)
         from jsonb_array_elements(coalesce(o.items,'[]'::jsonb)) AS i(value)
         where i.value->>'id'=g.id limit 1),
        case when o.product_id=g.id then 1 end
      ) as required_qty
    ) as req
    where o.offer_type='special' and o.active
      and req.required_qty is not null and req.required_qty<=g.units
      and (o.begins_at is null or o.begins_at<=now())
      and (o.ends_at is null or o.ends_at>now())
   ),0)),0) into v_off
 from catalog_units g;
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
  if v_redeem<0 or v_redeem>greatest(0,v_available) then raise exception 'Invalid points redemption';end if;
  select round(v_redeem*c.point_value,2) into v_reward from public.gw_loyalty_config c where c.id=1;
                        if v_reward is null or v_reward>v_total then raise exception 'Invalid points redemption for current reward value';end if;
                           v_total:=v_total-v_reward;
  select case when c.enabled then floor(greatest(v_sub,0)/c.earn_per_amount)::integer else 0 end
                                   into v_earned from public.gw_loyalty_config c where c.id=1;
                                      if v_earned is null then raise exception 'Loyalty configuration missing';end if;
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
end$function$;

CREATE OR REPLACE FUNCTION public.gw_pos_manage_offers_v2(p_token text, p_id bigint, p_title text, p_type text, p_product text, p_percent numeric, p_items jsonb, p_price numeric, p_start timestamp with time zone, p_end timestamp with time zone, p_active boolean, p_custom_items jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
 v_id bigint; v_extra jsonb; v_name text; v_quantity text;
 v_special jsonb := '[]'::jsonb; v_selected text; v_seen text[] := array[]::text[];
begin
 if not public.gw_mdt_can(p_token,'offers_manage') then
  raise exception 'Offer management permission required';
 end if;
 if coalesce(jsonb_typeof(p_custom_items),'null') <> 'array' then
  raise exception 'Custom items must be a list';
 end if;
 if jsonb_array_length(p_custom_items)>15 then
  raise exception 'Too many custom items (maximum 15)';
 end if;
 if p_type <> 'bundle' and jsonb_array_length(p_custom_items)>0 then
  raise exception 'Custom extras are only supported in bundles';
 end if;
 for v_extra in select value from jsonb_array_elements(p_custom_items) loop
  if jsonb_typeof(v_extra) <> 'object'
   or jsonb_typeof(v_extra->'name') <> 'string' then
   raise exception 'Custom items require a name';
  end if;
  v_name:=btrim(v_extra->>'name');
  v_quantity:=v_extra->>'qty';
  if char_length(v_name) not between 1 and 120
   or v_name ~ '[[:cntrl:]]'
   or v_quantity is null or v_quantity !~ '^[0-9]{1,2}$'
   or v_quantity::integer not between 1 and 50 then
   raise exception 'Custom item name must be 1-120 characters and quantity 1-50';
  end if;
 end loop;
 if p_type='special' then
  if coalesce(jsonb_typeof(p_items),'null') <> 'array' then
   raise exception 'Special products must be a list';
  end if;
  if jsonb_array_length(p_items)>15 then
   raise exception 'A special can include up to 15 products';
  end if;
  if jsonb_array_length(p_items)=0 then
   -- Legacy clients still submit a single p_product with no items.
   v_special:=jsonb_build_array(jsonb_build_object('id',p_product,'qty',1));
  else
   for v_extra in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_extra) <> 'object'
     or jsonb_typeof(v_extra->'id') <> 'string' then
     raise exception 'Each special product needs a valid catalog ID';
    end if;
    v_selected:=v_extra->>'id';
    v_quantity:=v_extra->>'qty';
    if v_quantity is null or v_quantity !~ '^[0-9]{1,2}$'
       or v_quantity::integer not between 1 and 50 then
      raise exception 'Special product quantity must be from 1 to 50';
    end if;
    if v_selected=any(v_seen) then
     raise exception 'A product cannot appear twice in the same special';
    end if;
    if not exists(select 1 from public.products p where p.id::text=v_selected and p.active) then
     raise exception 'Special product is unavailable or inactive';
    end if;
    v_seen:=array_append(v_seen,v_selected);
    v_special:=v_special||jsonb_build_array(jsonb_build_object('id',v_selected,'qty',v_quantity::integer));
   end loop;
   if p_product is distinct from v_special->0->>'id' then
    raise exception 'First special product must match the primary product';
   end if;
  end if;
 end if;
 -- Existing validation, authorization and legacy product_id handling remain in place.
 v_id:=public.gw_pos_manage_offers(p_token,p_id,p_title,p_type,p_product,p_percent,
  p_items,p_price,p_start,p_end,p_active);
 update public.gw_pos_offers
 set items=case when p_type='special' then v_special else items end,
     custom_items=case when p_type='bundle' then p_custom_items else '[]'::jsonb end
 where id=v_id;
 return v_id;
end
$function$;
