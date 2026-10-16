-- Save receipt discounts and original subtotal for new sales.
BEGIN;
CREATE TABLE IF NOT EXISTS public.gw_pos_receipt_financials(
 sale_id text PRIMARY KEY,
 details jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gw_pos_receipt_financials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gw_pos_receipt_financials FROM anon,authenticated;
CREATE OR REPLACE FUNCTION public.gw_pos_save_receipt_financials(p_token text,p_sale text,p_details jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF public.gw_employee_for_token(p_token) IS NULL THEN RAISE EXCEPTION 'Employee PIN required';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.gw_pos_sale_details(p_token,p_sale)) THEN RAISE EXCEPTION 'Sale not found';END IF;
 IF jsonb_typeof(p_details)<>'object' THEN RAISE EXCEPTION 'Invalid receipt details';END IF;
 INSERT INTO public.gw_pos_receipt_financials(sale_id,details) VALUES(p_sale,p_details)
 ON CONFLICT(sale_id) DO NOTHING;
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION public.gw_pos_get_receipt_financials(p_token text,p_sale text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_details jsonb;
BEGIN
 IF public.gw_employee_for_token(p_token) IS NULL THEN RAISE EXCEPTION 'Employee PIN required';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.gw_pos_sale_details(p_token,p_sale)) THEN RAISE EXCEPTION 'Sale not found';END IF;
 SELECT r.details INTO v_details FROM public.gw_pos_receipt_financials r WHERE r.sale_id=p_sale;
 RETURN v_details;
END $$;
REVOKE ALL ON FUNCTION public.gw_pos_save_receipt_financials(text,text,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gw_pos_get_receipt_financials(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gw_pos_save_receipt_financials(text,text,jsonb) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gw_pos_get_receipt_financials(text,text) TO anon,authenticated;
COMMIT;