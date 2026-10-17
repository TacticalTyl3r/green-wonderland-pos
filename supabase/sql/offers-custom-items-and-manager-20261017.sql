-- Green Wonderland Offers Manager V2 (2026-10-17)
-- Custom bundle extras are descriptive and do not become POS catalog products.
-- Existing catalog-based checkout calculation and loyalty logic are unchanged.
alter table public.gw_pos_offers
 add column if not exists custom_items jsonb not null default '[]'::jsonb;

create or replace function public.gw_pos_manage_offers_v2(
 p_token text, p_id bigint, p_title text, p_type text, p_product text,
 p_percent numeric, p_items jsonb, p_price numeric,
 p_start timestamptz, p_end timestamptz, p_active boolean,
 p_custom_items jsonb
) returns bigint
language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_id bigint; v_extra jsonb; v_name text; v_quantity text;
begin
 if not public.gw_mdt_can(p_token,'offers_manage') then
  raise exception 'Offer management permission required';
 end if;
 if coalesce(jsonb_typeof(p_custom_items),'null') <> 'array'
   or jsonb_array_length(p_custom_items)>15 then
  raise exception 'Invalid custom item list (maximum 15)';
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
 -- Existing validation and Boss/role authorization apply to the real products.
 v_id:=public.gw_pos_manage_offers(p_token,p_id,p_title,p_type,p_product,p_percent,
   p_items,p_price,p_start,p_end,p_active);
 update public.gw_pos_offers
 set custom_items=case when p_type='bundle' then p_custom_items else '[]'::jsonb end
 where id=v_id;
 return v_id;
end $$;
revoke all on function public.gw_pos_manage_offers_v2(text,bigint,text,text,text,numeric,jsonb,numeric,timestamptz,timestamptz,boolean,jsonb)
 from public,anon,authenticated;
grant execute on function public.gw_pos_manage_offers_v2(text,bigint,text,text,text,numeric,jsonb,numeric,timestamptz,timestamptz,boolean,jsonb)
 to anon,authenticated;

create or replace function public.gw_pos_delete_offer(p_token text,p_id bigint)
returns void language plpgsql security definer set search_path=public,pg_temp
as $$
begin
 if not public.gw_mdt_can(p_token,'offers_manage') then
  raise exception 'Offer management permission required';
 end if;
 if p_id is null then raise exception 'Choose an offer to delete'; end if;
 delete from public.gw_pos_offers where id=p_id;
 if not found then raise exception 'Offer not found'; end if;
end $$;
revoke all on function public.gw_pos_delete_offer(text,bigint) from public,anon,authenticated;
grant execute on function public.gw_pos_delete_offer(text,bigint) to anon,authenticated;
