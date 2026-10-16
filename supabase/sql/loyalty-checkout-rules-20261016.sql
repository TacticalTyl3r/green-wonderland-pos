-- Apply configurable loyalty values to the existing verified checkout.
-- Fails without changing checkout if its known source structure has changed.
DO $migration$
DECLARE
 v_source text;
 v_updated text;
 v_signature regprocedure := to_regprocedure('public.gw_pos_checkout_v4(text,uuid,jsonb,text,text,numeric,uuid,integer,numeric)');
BEGIN
 IF v_signature IS NULL THEN RAISE EXCEPTION 'Checkout function not found'; END IF;
 v_source := pg_get_functiondef(v_signature);
 v_updated := v_source;
 IF position('v_reward:=v_redeem;v_total:=v_total-v_reward;' in v_updated)=0
 OR position('v_earned:=floor(greatest(v_sub-v_off-v_manual-v_reward,0)/100);' in v_updated)=0
 THEN RAISE EXCEPTION 'Checkout implementation differs from expected version. No changes made.'; END IF;
 IF position('or v_redeem>floor(v_total) then raise exception ''Invalid points redemption'';end if;' in v_updated)=0
 THEN RAISE EXCEPTION 'Redemption validation differs from expected version. No changes made.'; END IF;
 v_updated := replace(v_updated,
  'or v_redeem>floor(v_total) then raise exception ''Invalid points redemption'';end if;',
  'then raise exception ''Invalid points redemption'';end if;');
 v_updated := replace(v_updated,
  'v_reward:=v_redeem;v_total:=v_total-v_reward;',
  'select round(v_redeem*c.point_value,2) into v_reward from public.gw_loyalty_config c where c.id=1;
   if v_reward is null or v_reward>v_total then raise exception ''Invalid points redemption for current reward value'';end if;
   v_total:=v_total-v_reward;');
 v_updated := replace(v_updated,
  'v_earned:=floor(greatest(v_sub-v_off-v_manual-v_reward,0)/100);',
  'select case when c.enabled then floor(greatest(v_sub-v_off-v_manual-v_reward,0)/c.earn_per_amount)::integer else 0 end
   into v_earned from public.gw_loyalty_config c where c.id=1;
   if v_earned is null then raise exception ''Loyalty configuration missing'';end if;');
 EXECUTE v_updated;
END $migration$;

-- PIN-authenticated checkout rate lookup; separate from management permissions.
create or replace function public.gw_loyalty_checkout_config(p_token text)
returns table(earn_per_amount numeric,point_value numeric,enabled boolean)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if public.gw_employee_for_token(p_token) is null then raise exception 'Employee PIN required';end if;
 return query select c.earn_per_amount,c.point_value,c.enabled from public.gw_loyalty_config c where c.id=1;
end $$;
grant execute on function public.gw_loyalty_checkout_config(text) to anon,authenticated;
