-- Weekly employee hours, Monday 00:00 UTC to next Monday.
-- Employee PIN session is required; no public employee hours disclosure.
create or replace function public.gw_my_weekly_hours(p_token text)
returns numeric
language plpgsql stable security definer
set search_path=public,pg_temp
as $$
declare
  eid uuid := public.gw_employee_for_token(p_token);
  week_start timestamptz := date_trunc('week',now() at time zone 'UTC') at time zone 'UTC';
  total_minutes numeric;
begin
  if eid is null then raise exception 'Employee session required'; end if;
  select coalesce(sum(extract(epoch from (
    least(coalesce(s.clock_out,now()),now())-greatest(s.clock_in,week_start)
  ))/60),0)
  into total_minutes
  from public.gw_shifts s
  where s.employee_id=eid and s.clock_in<now()
    and coalesce(s.clock_out,now())>week_start;
  return round(greatest(total_minutes,0)/60,2);
end;
$$;
revoke all on function public.gw_my_weekly_hours(text) from public;
grant execute on function public.gw_my_weekly_hours(text) to anon,authenticated;
