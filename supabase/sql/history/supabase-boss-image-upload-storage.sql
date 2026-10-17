-- Green Wonderland Boss PIN secure image uploads.
-- Run after supabase-boss-pin-admin.sql.
-- Public read is required to display store branding; upload/write operations are
-- NOT granted to anon or authenticated clients by this migration.
-- Image uploads run through the Boss-verified Edge Function using its service role.

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('gw-images','gw-images',true,3145728,array['image/png','image/jpeg','image/webp'])
on conflict(id) do update set
 public=true,
 file_size_limit=3145728,
 allowed_mime_types=array['image/png','image/jpeg','image/webp'];

-- Review existing storage policies (read-only output). Remove any broadly
-- permissive INSERT/UPDATE/DELETE policies separately after reviewing them.
select policyname,cmd,roles,qual,with_check
from pg_policies where schemaname='storage' and tablename='objects'
order by policyname;
