-- Green Wonderland: role-based branding permissions.
-- Run in Supabase SQL Editor. Before running the final INSERT below,
-- replace the placeholder with your Boss account's Supabase Auth user UUID.
create table if not exists public.gw_staff_permissions (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '',
 role text not null default 'Salesman' check (role in ('Boss','Manager','Senior Salesman','Salesman')),
 can_manage_branding boolean not null default false,
 can_manage_product_images boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.gw_staff_permissions enable row level security;
create or replace function public.gw_is_boss()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$select exists(select 1 from public.gw_staff_permissions where user_id=auth.uid() and role='Boss')$$;
create or replace function public.gw_can_manage_branding()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$select exists(select 1 from public.gw_staff_permissions where user_id=auth.uid() and (role='Boss' or can_manage_branding))$$;
create or replace function public.gw_can_manage_product_images()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$select exists(select 1 from public.gw_staff_permissions where user_id=auth.uid() and (role='Boss' or can_manage_product_images))$$;
revoke all on function public.gw_is_boss() from public;
revoke all on function public.gw_can_manage_branding() from public;
revoke all on function public.gw_can_manage_product_images() from public;
grant execute on function public.gw_is_boss() to authenticated;
grant execute on function public.gw_can_manage_branding() to authenticated;
grant execute on function public.gw_can_manage_product_images() to authenticated;
drop policy if exists "Boss reads staff" on public.gw_staff_permissions;
create policy "Boss reads staff" on public.gw_staff_permissions for select to authenticated using (public.gw_is_boss() or user_id=auth.uid());
drop policy if exists "Boss manages staff" on public.gw_staff_permissions;
create policy "Boss manages staff" on public.gw_staff_permissions for all to authenticated using (public.gw_is_boss()) with check (public.gw_is_boss());
-- Restrict both branding database changes and storage uploads.
drop policy if exists "Admins manage branding" on public.gw_branding;
drop policy if exists "Boss or delegated branding managers" on public.gw_branding;
create policy "Boss or delegated branding managers" on public.gw_branding for all to authenticated
 using (public.gw_can_manage_branding()) with check (public.gw_can_manage_branding());
drop policy if exists "Admins upload GW images" on storage.objects;
drop policy if exists "Delegated GW image uploads" on storage.objects;
create policy "Delegated GW image uploads" on storage.objects for insert to authenticated
with check(bucket_id='gw-images' and (
 (split_part(name,'/',1)='product' and public.gw_can_manage_product_images())
 or (split_part(name,'/',1) in ('main_logo','login_logo','receipt_logo','dashboard_logo','favicon') and public.gw_can_manage_branding())
));
-- Existing product UPDATE policies may be broader than this feature.
-- For strict image-only delegation, update product photos through a security-definer RPC.
create or replace function public.gw_set_product_image(p_product_id uuid,p_image_url text)
returns void language plpgsql security definer set search_path=public,pg_temp
as $$
begin
 if not public.gw_can_manage_product_images() then raise exception 'Not permitted'; end if;
 if p_image_url is null or p_image_url not like 'https://%' or position('/storage/v1/object/public/gw-images/product/' in p_image_url)=0 then
 raise exception 'Invalid product image URL'; end if;
 update public.products set image_url=p_image_url where id=p_product_id;
 if not found then raise exception 'Product not found'; end if;
end;$$;
revoke all on function public.gw_set_product_image(uuid,text) from public;
grant execute on function public.gw_set_product_image(uuid,text) to authenticated;
-- Boss bootstrap (run once, substituting a real auth.users UUID):
-- insert into public.gw_staff_permissions(user_id,display_name,role)
-- values ('YOUR-BOSS-AUTH-USER-UUID','Boss','Boss')
-- on conflict(user_id) do update set role='Boss';
