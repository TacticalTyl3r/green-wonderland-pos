-- Run once in Supabase SQL Editor before using the Branding Manager.
create table if not exists public.gw_branding (
  slot text primary key check(slot in ('main_logo','login_logo','receipt_logo','dashboard_logo','favicon')),
  image_url text not null,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.gw_branding enable row level security;
drop policy if exists "Read active branding" on public.gw_branding;
create policy "Read active branding" on public.gw_branding for select to anon, authenticated using(active);
drop policy if exists "Admins manage branding" on public.gw_branding;
create policy "Admins manage branding" on public.gw_branding for all to authenticated using(public.is_admin()) with check(public.is_admin());
alter table public.products add column if not exists image_url text;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('gw-images','gw-images',true,3145728,array['image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=true,file_size_limit=3145728,allowed_mime_types=array['image/png','image/jpeg','image/webp'];
drop policy if exists "Admins upload GW images" on storage.objects;
create policy "Admins upload GW images" on storage.objects for insert to authenticated
with check(bucket_id='gw-images' and public.is_admin());
-- Old files are retained to allow restoration; storage deletion is not exposed to the browser.
