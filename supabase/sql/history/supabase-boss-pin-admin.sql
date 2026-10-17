-- Green Wonderland: Boss employee PIN authorization for catalog and role administration.
-- Run AFTER employee PIN, role permissions and MDT migrations.
-- NEVER add public write policies to products/settings/storage to replace email login.
-- Authenticated employee PIN sessions are checked INSIDE every write RPC.

create or replace function public.gw_boss_pin_check(p_token text)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.gw_employees e
 where e.id=public.gw_employee_for_token(p_token) and e.active and e.role='Boss')
$$;
revoke all on function public.gw_boss_pin_check(text) from public,anon,authenticated;
grant execute on function public.gw_boss_pin_check(text) to anon,authenticated;

create or replace function public.gw_boss_catalog_change(
 p_token text,p_table text,p_action text,p_id text,p_values jsonb
) returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare
 result text; payload jsonb:=coalesce(p_values,'{}'::jsonb);
begin
 if not public.gw_boss_pin_check(p_token) then raise exception 'Boss employee PIN required'; end if;
 if p_action not in ('insert','update','delete') or p_table not in ('products','delivery_zones','app_settings')
 then raise exception 'Unsupported catalog change';end if;
 if p_action<>'insert' and nullif(p_id,'') is null then raise exception 'Missing record ID';end if;
 if p_table='products' then
  if p_action='insert' then
   insert into public.products(name,category,price,active,ingredients)
   values('New product','Other',0,false,'[]'::jsonb) returning id::text into result;
  elsif p_action='delete' then
   delete from public.products where id::text=p_id returning id::text into result;
  else
   if not (payload ?& array['name','category','price','active']) then raise exception 'Missing product fields';end if;
   if length(trim(payload->>'name')) not between 1 and 150
     or length(trim(payload->>'category')) not between 1 and 100
     or (payload->>'price')::numeric<0 or (payload->>'price')::numeric>10000000
   then raise exception 'Invalid product fields';end if;
   if payload->>'image_url' is not null and payload->>'image_url'!~ '^https://' then raise exception 'Image URL must use HTTPS';end if;
   if jsonb_typeof(coalesce(payload->'ingredients','[]'::jsonb))<>'array'
     or jsonb_typeof(coalesce(payload->'options','[]'::jsonb))<>'array'
   then raise exception 'Invalid product lists';end if;
   update public.products set
    name=trim(payload->>'name'),
    category=trim(payload->>'category'),
    price=(payload->>'price')::numeric,
    active=(payload->>'active')::boolean,
    image_url=nullif(payload->>'image_url',''),
    ingredients=coalesce(payload->'ingredients','[]'::jsonb),
    options=coalesce(payload->'options','[]'::jsonb)
   where id::text=p_id returning id::text into result;
  end if;
 elsif p_table='delivery_zones' then
  if p_action='insert' then
   insert into public.delivery_zones(name,fee) values('New zone',0)
   returning id::text into result;
  elsif p_action='delete' then
   delete from public.delivery_zones where id::text=p_id returning id::text into result;
  else
   if length(trim(coalesce(payload->>'name',''))) not between 1 and 100
    or (payload->>'fee')::numeric<0 or (payload->>'fee')::numeric>1000000 then
     raise exception 'Invalid delivery zone';end if;
   update public.delivery_zones set name=trim(payload->>'name'),fee=(payload->>'fee')::numeric
   where id::text=p_id returning id::text into result;
  end if;
 else
  if p_action<>'update' or p_id<>'1' then raise exception 'Only application settings update is allowed';end if;
  if (payload->>'max_discount')::numeric not between 0 and 100 then raise exception 'Invalid discount';end if;
  update public.app_settings set max_discount=(payload->>'max_discount')::numeric
  where id=1 returning id::text into result;
 end if;
 if result is null then raise exception 'Record not found or not changed';end if;
 return result;
end$$;
revoke all on function public.gw_boss_catalog_change(text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.gw_boss_catalog_change(text,text,text,text,jsonb) to anon,authenticated;

create or replace function public.gw_boss_role_permissions(p_token text)
returns table(role text,feature text,allowed boolean)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.gw_boss_pin_check(p_token) then raise exception 'Boss employee PIN required';end if;
 return query select r.role::text,r.feature::text,r.allowed
 from public.gw_mdt_role_permissions r order by r.role,r.feature;
end$$;
revoke all on function public.gw_boss_role_permissions(text) from public,anon,authenticated;
grant execute on function public.gw_boss_role_permissions(text) to anon,authenticated;

create or replace function public.gw_boss_set_role_permission(
 p_token text,p_role text,p_feature text,p_allowed boolean
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.gw_boss_pin_check(p_token) then raise exception 'Boss employee PIN required';end if;
 if p_role not in ('Manager','Senior Salesman','Salesman') then raise exception 'Cannot change Boss permissions';end if;
 if not exists(select 1 from public.gw_mdt_role_permissions r where r.feature=p_feature)
 then raise exception 'Unknown permission';end if;
 insert into public.gw_mdt_role_permissions(role,feature,allowed)
 values(p_role,p_feature,p_allowed)
 on conflict(role,feature) do update set allowed=excluded.allowed;
end$$;
revoke all on function public.gw_boss_set_role_permission(text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.gw_boss_set_role_permission(text,text,text,boolean) to anon,authenticated;

-- Branding and product images can be managed from a Boss PIN using existing HTTPS
-- image URLs. Actual binary uploads still require a secured storage-upload endpoint.
create or replace function public.gw_boss_set_image_url(
 p_token text,p_slot text,p_product text,p_url text
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.gw_boss_pin_check(p_token) then raise exception 'Boss employee PIN required';end if;
 if p_url is not null and (length(p_url)>2000 or p_url!~* '^https://') then
  raise exception 'Image must use an HTTPS URL';
 end if;
 if p_slot='product' then
  if p_product is null then raise exception 'Choose a product';end if;
  update public.products set image_url=p_url where id::text=p_product;
  if not found then raise exception 'Product not found';end if;
 elsif p_slot in ('main_logo','login_logo','receipt_logo','dashboard_logo','favicon') then
  if p_url is null then
   delete from public.gw_branding where slot=p_slot;
  else
   insert into public.gw_branding(slot,image_url,active)
   values(p_slot,p_url,true)
   on conflict(slot) do update set image_url=excluded.image_url,active=true;
  end if;
 else raise exception 'Invalid image location';end if;
end$$;
revoke all on function public.gw_boss_set_image_url(text,text,text,text) from public,anon,authenticated;
grant execute on function public.gw_boss_set_image_url(text,text,text,text) to anon,authenticated;
