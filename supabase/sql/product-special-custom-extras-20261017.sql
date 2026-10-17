-- Allows Product Specials to carry descriptive custom extras, same as Bundles.
-- Custom extras are not catalog products and do not alter discount math.
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
 if p_type not in ('bundle','special') and jsonb_array_length(p_custom_items)>0 then
  raise exception 'Custom extras are only supported in product offers';
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
     custom_items=case when p_type in ('bundle','special') then p_custom_items else '[]'::jsonb end
 where id=v_id;
 return v_id;
end
$function$;
