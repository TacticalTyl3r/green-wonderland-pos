-- Green Wonderland: durable, cross-device loyalty receipt snapshots.
-- Additive only: no existing sales, loyalty balances, or checkout routines are changed.
-- Save is one-time per sale and derives points from the server's recorded sale details.
BEGIN;
CREATE TABLE IF NOT EXISTS public.gw_loyalty_receipt_snapshots (
 sale_id text PRIMARY KEY,
 member_id uuid NOT NULL,
 member_code text NOT NULL,
 member_name text NOT NULL,
 points_earned integer NOT NULL,
 points_redeemed integer NOT NULL,
 points_remaining integer NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 recorded_by uuid NOT NULL
);
ALTER TABLE public.gw_loyalty_receipt_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gw_loyalty_receipt_snapshots FROM anon,authenticated;

CREATE OR REPLACE FUNCTION public.gw_pos_save_loyalty_receipt(p_token text,p_sale text,p_member_code text)
RETURNS TABLE(sale_id text,member_code text,member_name text,points_earned integer,points_redeemed integer,points_remaining integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 v_employee uuid; v_sale jsonb; v_member jsonb; v_name text;
BEGIN
 v_employee := public.gw_employee_for_token(p_token);
 IF v_employee IS NULL THEN RAISE EXCEPTION 'Employee PIN required';END IF;
 IF nullif(trim(coalesce(p_sale,'')),'') IS NULL OR nullif(trim(coalesce(p_member_code,'')),'') IS NULL THEN
  RAISE EXCEPTION 'Sale and customer CID required';
 END IF;
 SELECT to_jsonb(d) INTO v_sale FROM public.gw_pos_sale_details(p_token,p_sale) d LIMIT 1;
 IF v_sale IS NULL THEN RAISE EXCEPTION 'Recorded sale not found or access denied';END IF;
 SELECT to_jsonb(m) INTO v_member FROM public.gw_loyalty_find(p_token,trim(p_member_code)) m LIMIT 1;
 IF v_member IS NULL OR NULLIF(v_member->>'id','') IS NULL THEN RAISE EXCEPTION 'Loyalty member not found';END IF;
 v_name := nullif(v_sale->>'member_name','');
 IF v_name IS NULL THEN RAISE EXCEPTION 'Sale has no loyalty member';END IF;
 IF (v_sale->>'member_id') IS NOT NULL AND (v_sale->>'member_id') <> (v_member->>'id') THEN
  RAISE EXCEPTION 'Sale is for a different member';
 END IF;
 IF lower(trim(v_name)) <> lower(trim(v_member->>'display_name')) THEN
  RAISE EXCEPTION 'Sale member does not match this CID';
 END IF;
 INSERT INTO public.gw_loyalty_receipt_snapshots
 (sale_id,member_id,member_code,member_name,points_earned,points_redeemed,points_remaining,recorded_by)
 VALUES (p_sale,(v_member->>'id')::uuid,v_member->>'member_code',v_member->>'display_name',
  coalesce((v_sale->>'points_earned')::integer,0),
  coalesce((v_sale->>'points_redeemed')::integer,0),
  (v_member->>'points')::integer,v_employee)
 ON CONFLICT (sale_id) DO NOTHING;
 RETURN QUERY SELECT r.sale_id,r.member_code,r.member_name,r.points_earned,r.points_redeemed,r.points_remaining
 FROM public.gw_loyalty_receipt_snapshots r WHERE r.sale_id=p_sale;
END $$;

CREATE OR REPLACE FUNCTION public.gw_pos_get_loyalty_receipt(p_token text,p_sale text)
RETURNS TABLE(sale_id text,member_code text,member_name text,points_earned integer,points_redeemed integer,points_remaining integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF public.gw_employee_for_token(p_token) IS NULL THEN RAISE EXCEPTION 'Employee PIN required';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.gw_pos_sale_details(p_token,p_sale)) THEN
  RAISE EXCEPTION 'Recorded sale not found or access denied';
 END IF;
 RETURN QUERY SELECT r.sale_id,r.member_code,r.member_name,r.points_earned,r.points_redeemed,r.points_remaining
 FROM public.gw_loyalty_receipt_snapshots r WHERE r.sale_id=p_sale;
END $$;

REVOKE ALL ON FUNCTION public.gw_pos_save_loyalty_receipt(text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gw_pos_get_loyalty_receipt(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gw_pos_save_loyalty_receipt(text,text,text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gw_pos_get_loyalty_receipt(text,text) TO anon,authenticated;
COMMIT;
