-- Apply in Supabase SQL Editor to record employee names for future refunds and voids.
-- Requires the employee processing the adjustment to sign in with their own PIN.
-- Existing audit records remain unchanged, because "Boss" cannot be reliably
-- resolved to a specific person after the fact.
create or replace function public.gw_mdt_adjust_sale(
 p_token text,p_sale text,p_type text,p_amount numeric,p_reason text
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_total numeric;v_used numeric;v_actor text;
begin
 if not public.gw_mdt_can(p_token,'sales_adjust') then raise exception 'Access denied'; end if;
 select pm.employee_name into v_actor from public.gw_pin_me(p_token) pm limit 1;
 if v_actor is null or trim(v_actor)='' then
  raise exception 'Sign in with your employee PIN before processing a refund or void';
 end if;
 if p_type not in ('refund','void') then raise exception 'Invalid adjustment type'; end if;
 if length(trim(coalesce(p_reason,''))) not between 5 and 1000 then raise exception 'Reason must be 5-1000 characters'; end if;
 select s.total into v_total from public.gw_sales s where s.id::text=p_sale for update;
 if not found then raise exception 'Sale not found'; end if;
 select coalesce(sum(a.amount),0) into v_used from public.gw_mdt_sale_adjustments a where a.sale_id=p_sale;
 if v_total<=v_used then raise exception 'Sale already fully adjusted'; end if;
 if p_amount is null or p_amount<=0 or round(p_amount,2)<>p_amount
    or p_amount>v_total-v_used then raise exception 'Invalid adjustment amount'; end if;
 if p_type='void' and p_amount<>v_total-v_used then raise exception 'Void must cover the entire remaining balance'; end if;
 insert into public.gw_mdt_sale_adjustments(sale_id,adjustment_type,amount,reason,performed_by)
 values(p_sale,p_type,p_amount,trim(p_reason),trim(v_actor));
end$$;
revoke all on function public.gw_mdt_adjust_sale(text,text,text,numeric,text) from public,anon,authenticated;
grant execute on function public.gw_mdt_adjust_sale(text,text,text,numeric,text) to anon,authenticated;
