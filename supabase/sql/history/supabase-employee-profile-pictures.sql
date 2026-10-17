-- Green Wonderland employee roster photos
-- Uses the existing token resolver from gw_pin_me; no legacy public.employees references.
alter table public.gw_employees add column if not exists profile_image_url text;

create or replace function public.gw_my_profile_picture(p_token text)
returns text language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_id uuid; v_url text;
begin
  v_id := public.gw_employee_for_token(p_token);
  if v_id is null then raise exception 'Valid employee PIN session required'; end if;
  select e.profile_image_url into v_url from public.gw_employees e where e.id=v_id;
  return v_url;
end;
$$;

create or replace function public.gw_update_my_profile_picture(p_token text,p_url text)
returns void language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_id uuid; v_url text;
begin
  v_id := public.gw_employee_for_token(p_token);
  if v_id is null then raise exception 'Valid employee PIN session required'; end if;
  v_url := nullif(trim(p_url),'');
  if v_url is not null and (length(v_url)>2048 or v_url !~* '^https://') then
    raise exception 'Use a public HTTPS image URL';
  end if;
  update public.gw_employees set profile_image_url=v_url where id=v_id;
  if not found then raise exception 'Employee record not found'; end if;
end;
$$;

create or replace function public.gw_employee_profile_images(p_token text)
returns table(employee_id uuid,profile_image_url text)
language plpgsql security definer set search_path=public,pg_temp
as $$
begin
  if public.gw_employee_for_token(p_token) is null then
    raise exception 'Valid employee PIN session required';
  end if;
  return query
    select e.id,e.profile_image_url from public.gw_employees e
    where e.profile_image_url is not null;
end;
$$;

revoke all on function public.gw_my_profile_picture(text) from public;
revoke all on function public.gw_update_my_profile_picture(text,text) from public;
revoke all on function public.gw_employee_profile_images(text) from public;
grant execute on function public.gw_my_profile_picture(text),
  public.gw_update_my_profile_picture(text,text),
  public.gw_employee_profile_images(text) to anon,authenticated;
