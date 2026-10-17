-- Customer identities for authorized Sales History receipts.
-- Uses the existing sale-detail access check, and never guesses a CID from a shared name.
BEGIN;
CREATE OR REPLACE FUNCTION public.gw_mdt_sales_customer_batch(p_token text,p_sales text[])
RETURNS TABLE(sale_id text, customer_name text, customer_cid text, points_earned integer, points_redeemed integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_sale text; v_detail jsonb; v_receipt record;
BEGIN
 IF public.gw_employee_for_token(p_token) IS NULL THEN RAISE EXCEPTION 'Employee PIN required';END IF;
 IF NOT public.gw_mdt_can(p_token,'sales_history')
  AND NOT EXISTS(SELECT 1 FROM public.gw_employees e WHERE e.id=public.gw_employee_for_token(p_token) AND e.active AND e.role='Boss')
 THEN RAISE EXCEPTION 'Sales history access required';END IF;
 FOR v_sale IN SELECT DISTINCT unnest(p_sales) LIMIT 200 LOOP
  SELECT to_jsonb(d) INTO v_detail FROM public.gw_pos_sale_details(p_token,v_sale) d LIMIT 1;
  IF v_detail IS NULL THEN CONTINUE; END IF;
  RETURN QUERY SELECT v_sale,
   COALESCE(r.member_name,NULLIF(v_detail->>'member_name','')),
   r.member_code,
   COALESCE(r.points_earned,NULLIF(v_detail->>'points_earned','')::integer),
   COALESCE(r.points_redeemed,NULLIF(v_detail->>'points_redeemed','')::integer)
  FROM (SELECT 1) one
  LEFT JOIN public.gw_loyalty_receipt_snapshots r ON r.sale_id=v_sale;
  v_detail:=NULL;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.gw_mdt_sales_customer_batch(text,text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gw_mdt_sales_customer_batch(text,text[]) TO anon,authenticated;
COMMIT;