-- Employee weekly worked time, accessible only to employees page viewers.
create or replace function public.gw_mdt_employee_weekly_hours(p_token text,p_employee uuid)
returns numeric language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result numeric;
begin
 if not public.gw_mdt_can(p_token,'employees') then raise exception 'Access denied'; end if;
 select coalesce(sum(extract(epoch from (least(coalesce(s.clock_out,now()),now())-greatest(s.clock_in,date_trunc('week',now()))))/3600),0)
 into result from public.gw_shifts s
 where s.employee_id=p_employee and s.clock_in<now() and coalesce(s.clock_out,now())>date_trunc('week',now());
 return round(greatest(result,0),2);
end$$;
revoke all on function public.gw_mdt_employee_weekly_hours(text,uuid) from public,anon,authenticated;
grant execute on function public.gw_mdt_employee_weekly_hours(text,uuid) to anon,authenticated;