-- Green Wonderland: Boss PIN-authorized browser uploads (no Edge Function)
-- Enable Anonymous Sign-Ins in Supabase Authentication > Providers before using.
create extension if not exists pgcrypto;
create table if not exists public.gw_image_upload_grants (
 user_id uuid primary key references auth.users(id) on delete cascade,
 expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
alter table public.gw_image_upload_grants enable row level security;
revoke all on public.gw_image_upload_grants from anon, authenticated;
create or replace function public.gw_authorize_image_upload(p_token text)
returns boolean language plpgsql security definer set search_path = public, pg_temp
as $$
declare allowed boolean;
begin
 if auth.uid() is null then return false; end if;
 select public.gw_boss_pin_check(p_token) into allowed;
 if allowed is distinct from true then return false; end if;
 insert into public.gw_image_upload_grants(user_id,expires_at)
 values(auth.uid(),now()+interval '5 minutes')
 on conflict(user_id) do update set expires_at=excluded.expires_at;
 return true;
end $$;
revoke all on function public.gw_authorize_image_upload(text) from public;
grant execute on function public.gw_authorize_image_upload(text) to authenticated;
-- Public read-only images; write operations restricted to recently verified Boss identities.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('gw-images','gw-images',true,3145728,array['image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=true,file_size_limit=3145728,allowed_mime_types=array['image/png','image/jpeg','image/webp'];
drop policy if exists "gw boss image insert" on storage.objects;
create policy "gw boss image insert" on storage.objects for insert to authenticated
with check(bucket_id='gw-images'
 and (storage.foldername(name))[1]='boss'
 and exists(select 1 from public.gw_image_upload_grants g where g.user_id=auth.uid() and g.expires_at>now()));
-- No update/delete policy: uploads use unique filenames; old images can be cleaned up separately.
