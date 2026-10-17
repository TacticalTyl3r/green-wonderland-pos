-- Recover the CID and CURRENT loyalty balance for an authenticated sale receipt.
-- Historical after-sale balance is only shown when an existing receipt snapshot has it.
-- A name match is accepted only when exactly one loyalty member matches.
BEGIN;
CREATE OR REPLACE FUNCTION public.gw_pos_receipt_member_lookup(p_token text,p_sale text)
RETURNS TABLE(member_code text,member_name text,current_points integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 v_sale jsonb;
 v_name text;
 v_table regclass;
 v_count integer;
BEGIN
 IF public.gw_employee_for_token(p_token) IS NULL THEN RAISE EXCEPTION 'Employee PIN required';END IF;
 SELECT to_jsonb(d) INTO v_sale FROM public.gw_pos_sale_details(p_token,p_sale) d LIMIT 1;
 IF v_sale IS NULL THEN RETURN;END IF;
 v_name:=nullif(btrim(v_sale->>'member_name'),'');
 IF v_name IS NULL THEN RETURN;END IF;
 SELECT c.oid INTO v_table FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname=ANY(ARRAY['gw_loyalty_members','gw_loyalty_customers','loyalty_members'])
 AND c.relkind IN ('r','p')
 AND EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attname='display_name' AND NOT a.attisdropped)
 AND EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attname='member_code' AND NOT a.attisdropped)
 AND EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attname='points' AND NOT a.attisdropped)
 ORDER BY CASE c.relname WHEN 'gw_loyalty_members' THEN 1 WHEN 'gw_loyalty_customers' THEN 2 ELSE 3 END LIMIT 1;
 IF v_table IS NULL THEN RETURN;END IF;
 EXECUTE format('SELECT count(*)::integer FROM %s WHERE lower(btrim(display_name))=lower($1)',v_table) INTO v_count USING v_name;
 IF v_count<>1 THEN RETURN;END IF;
 RETURN QUERY EXECUTE format('SELECT member_code::text,display_name::text,points::integer FROM %s WHERE lower(btrim(display_name))=lower($1)',v_table) USING v_name;
END $$;
REVOKE ALL ON FUNCTION public.gw_pos_receipt_member_lookup(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gw_pos_receipt_member_lookup(text,text) TO anon,authenticated;
COMMIT;
