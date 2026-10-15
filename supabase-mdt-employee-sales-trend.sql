-- Per-employee sales history for profile charts.
create or replace function public.gw_mdt_employee_sales_trend(p_token text,p_employee uuid)
returns table(day date,sales numeric,orders bigint)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.gw_mdt_can(p_token,'sales_earnings') then raise exception 'Access denied'; end if;
 return query select (s.created_at at time zone 'UTC')::date,sum(s.total)::numeric,count(*)::bigint
 from public.gw_sales s where s.employee_id=p_employee and s.created_at>=now()-interval '30 days'
 group by 1 order by 1;
end$$;
revoke all on function public.gw_mdt_employee_sales_trend(text,uuid) from public,anon,authenticated;
grant execute on function public.gw_mdt_employee_sales_trend(text,uuid) to anon,authenticated;