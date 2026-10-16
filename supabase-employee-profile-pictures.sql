alter table public.gw_employees add column if not exists profile_image_url text;

create or replace function public.gw_my_profile_picture(p_token text)
returns text language sql security definer set search_path=public
as $$
 select e.profile_image_url from public.gw_employees e
 join public.gw_pin_me(p_token) m on m.employee_id=e.id
 limit 1
$$;

create or replace function public.gw_update_my_profile_picture(p_token text,p_url text)
returns void language plpgsql security definer set search_path=public
as $$
begin
 if not exists(select 1 from public.gw_pin_me(p_token)) then raise exception 'Employee PIN login required';end if;
 if p_url is not null and (length(p_url)>2048 or p_url !~* '^https://') then raise exception 'Use a public HTTPS image URL';end if;
 update public.gw_employees set profile_image_url=nullif(trim(p_url),'')
 where id=(select employee_id from public.gw_pin_me(p_token) limit 1);
end $$;

create or replace function public.gw_employee_profile_images(p_token text)
returns table(employee_id uuid,profile_image_url text)
language plpgsql security definer set search_path=public
as $$
begin
 if not exists(select 1 from public.gw_pin_me(p_token)) then raise exception 'Employee PIN login required';end if;
 return query select e.id,e.profile_image_url from public.gw_employees e where e.active=true;
end $$;
grant execute on function public.gw_my_profile_picture(text),public.gw_update_my_profile_picture(text,text),public.gw_employee_profile_images(text) to anon,authenticated;
