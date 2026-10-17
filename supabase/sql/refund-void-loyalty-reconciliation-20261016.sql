-- Green Wonderland: atomic refund/void loyalty reconciliation.
-- Applies to FUTURE adjustments only; does not retroactively edit existing refunds.
-- The original sale is preserved, and one sale-row lock serializes concurrent adjustments.
BEGIN;
CREATE TABLE IF NOT EXISTS public.gw_mdt_adjustment_loyalty (
 adjustment_id bigint PRIMARY KEY REFERENCES public.gw_mdt_sale_adjustments(id),
 sale_id text NOT NULL,
 member_id uuid NOT NULL REFERENCES public.gw_loyalty_members(id),
 earned_reversed integer NOT NULL DEFAULT 0 CHECK (earned_reversed >= 0),
 redeemed_restored integer NOT NULL DEFAULT 0 CHECK (redeemed_restored >= 0),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gw_mdt_adjustment_loyalty_sale_idx ON public.gw_mdt_adjustment_loyalty(sale_id);
ALTER TABLE public.gw_mdt_adjustment_loyalty ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gw_mdt_adjustment_loyalty FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.gw_mdt_adjust_sale(
 p_token text,p_sale text,p_type text,p_amount numeric,p_reason text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 v_sale uuid;
 v_total numeric;
 v_used numeric;
 v_actor uuid;
 v_actor_name text;
 v_adjustment bigint;
 v_member uuid;
 v_earned integer;
 v_redeemed integer;
 v_pre_earned integer;
 v_post_earned integer;
 v_pre_redeemed integer;
 v_post_redeemed integer;
 v_reverse_earned integer;
 v_restore_redeemed integer;
BEGIN
 IF NOT public.gw_mdt_can(p_token,'sales_adjust') THEN RAISE EXCEPTION 'Refund / void permission required';END IF;
 v_actor:=public.gw_employee_for_token(p_token);
 SELECT e.name INTO v_actor_name FROM public.gw_employees e WHERE e.id=v_actor AND e.active;
 IF v_actor_name IS NULL THEN RAISE EXCEPTION 'Sign in with an active employee PIN';END IF;
 IF p_type NOT IN ('refund','void') THEN RAISE EXCEPTION 'Invalid adjustment type';END IF;
 IF length(btrim(coalesce(p_reason,''))) NOT BETWEEN 5 AND 1000 THEN RAISE EXCEPTION 'Reason must be 5-1000 characters';END IF;
 SELECT s.id,s.total INTO v_sale,v_total FROM public.gw_sales s WHERE s.id::text=p_sale FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sale not found';END IF;
 SELECT coalesce(sum(a.amount),0) INTO v_used FROM public.gw_mdt_sale_adjustments a WHERE a.sale_id=p_sale;
 IF v_total<=v_used THEN RAISE EXCEPTION 'Sale already fully adjusted';END IF;
 IF p_amount IS NULL OR p_amount<=0 OR round(p_amount,2)<>p_amount
  OR p_amount>v_total-v_used THEN RAISE EXCEPTION 'Invalid adjustment amount';END IF;
 IF p_type='void' AND p_amount<>v_total-v_used THEN RAISE EXCEPTION 'Void must cover entire remaining balance';END IF;
 -- Row lock on the original sale serializes both refund amount and loyalty calculations.
 SELECT m.member_id,m.points_earned,m.points_redeemed
 INTO v_member,v_earned,v_redeemed
 FROM public.gw_pos_sale_meta m WHERE m.sale_id=v_sale;
 v_earned:=greatest(0,coalesce(v_earned,0));
 v_redeemed:=greatest(0,coalesce(v_redeemed,0));
 IF v_member IS NOT NULL AND v_total>0 THEN
  -- Cumulative rounding ensures a fully adjusted sale reverses exactly 100%.
  v_pre_earned:=floor(v_earned*v_used/v_total);
  v_post_earned:=floor(v_earned*(v_used+p_amount)/v_total);
  v_pre_redeemed:=floor(v_redeemed*v_used/v_total);
  v_post_redeemed:=floor(v_redeemed*(v_used+p_amount)/v_total);
  v_reverse_earned:=v_post_earned-v_pre_earned;
  v_restore_redeemed:=v_post_redeemed-v_pre_redeemed;
 ELSE
  v_reverse_earned:=0;v_restore_redeemed:=0;
 END IF;
 INSERT INTO public.gw_mdt_sale_adjustments(sale_id,adjustment_type,amount,reason,performed_by)
 VALUES(p_sale,p_type,p_amount,btrim(p_reason),v_actor_name) RETURNING id INTO v_adjustment;
 IF v_member IS NOT NULL THEN
  UPDATE public.gw_loyalty_members
  SET points=points-v_reverse_earned+v_restore_redeemed,
      lifetime_earned=greatest(0,lifetime_earned-v_reverse_earned)
  WHERE id=v_member;
  IF NOT FOUND THEN RAISE EXCEPTION 'Loyalty member missing; adjustment cancelled';END IF;
  INSERT INTO public.gw_mdt_adjustment_loyalty(adjustment_id,sale_id,member_id,earned_reversed,redeemed_restored)
  VALUES(v_adjustment,p_sale,v_member,v_reverse_earned,v_restore_redeemed);
  IF v_reverse_earned>0 THEN
   INSERT INTO public.gw_loyalty_ledger(member_id,sale_id,points_delta,note,performed_by)
   VALUES(v_member,v_sale,-v_reverse_earned,'Points reversed for '||p_type||' #'||v_adjustment,v_actor);
  END IF;
  IF v_restore_redeemed>0 THEN
   INSERT INTO public.gw_loyalty_ledger(member_id,sale_id,points_delta,note,performed_by)
   VALUES(v_member,v_sale,v_restore_redeemed,'Redeemed points restored for '||p_type||' #'||v_adjustment,v_actor);
  END IF;
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.gw_mdt_adjustment_loyalty_audit(p_token text)
RETURNS TABLE(adjustment_id bigint,earned_reversed integer,redeemed_restored integer,member_code text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT public.gw_mdt_can(p_token,'sales_history') AND NOT public.gw_mdt_can(p_token,'sales_adjust')
 THEN RAISE EXCEPTION 'Sales history permission required';END IF;
 RETURN QUERY SELECT a.adjustment_id,a.earned_reversed,a.redeemed_restored,m.member_code
 FROM public.gw_mdt_adjustment_loyalty a
 JOIN public.gw_loyalty_members m ON m.id=a.member_id
 ORDER BY a.adjustment_id DESC LIMIT 1000;
END $$;
CREATE OR REPLACE FUNCTION public.gw_mdt_sale_adjustments_details(p_token text)
RETURNS TABLE(id bigint,sale_id text,adjustment_type text,amount numeric,reason text,performed_by text,created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $
BEGIN
 IF NOT public.gw_mdt_can(p_token,'sales_history') AND NOT public.gw_mdt_can(p_token,'sales_adjust')
 THEN RAISE EXCEPTION 'Sales history permission required';END IF;
 RETURN QUERY SELECT a.id,a.sale_id,a.adjustment_type,a.amount,a.reason,a.performed_by,a.created_at
 FROM public.gw_mdt_sale_adjustments a ORDER BY a.created_at DESC LIMIT 500;
END $;
REVOKE ALL ON FUNCTION public.gw_mdt_sale_adjustments_details(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gw_mdt_sale_adjustments_details(text) TO anon,authenticated;
REVOKE ALL ON FUNCTION public.gw_mdt_adjust_sale(text,text,text,numeric,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gw_mdt_adjustment_loyalty_audit(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gw_mdt_adjust_sale(text,text,text,numeric,text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gw_mdt_adjustment_loyalty_audit(text) TO anon,authenticated;
COMMIT;