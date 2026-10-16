-- Durable itemized receipts for verified POS sales. Additive migration.
BEGIN;
CREATE TABLE IF NOT EXISTS public.gw_pos_receipt_items (
 sale_id text PRIMARY KEY,
 line_items jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gw_pos_receipt_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gw_pos_receipt_items FROM anon,authenticated;
CREATE OR REPLACE FUNCTION public.gw_pos_save_receipt_items(p_token text,p_sale text,p_items jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF public.gw_employee_for_token(p_token) IS NULL THEN RAISE EXCEPTION 'Employee PIN required'; END IF;
 IF p_sale IS NULL OR p_sale='' OR NOT EXISTS(SELECT 1 FROM public.gw_pos_sale_details(p_token,p_sale)) THEN
  RAISE EXCEPTION 'Verified sale not found';
 END IF;
 IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items)=0 OR jsonb_array_length(p_items)>200 THEN
  RAISE EXCEPTION 'Invalid receipt items';
 END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) x
  WHERE jsonb_typeof(x)<>'object'
  OR coalesce(x->>'name','')=''
  OR coalesce((x->>'qty') ~ '^[0-9]+$' ,false)=false
  OR coalesce((x->>'total') ~ '^[0-9]+(\\.[0-9]+)?$',false)=false) THEN
  RAISE EXCEPTION 'Invalid receipt item details';
 END IF;
 INSERT INTO public.gw_pos_receipt_items(sale_id,line_items) VALUES(p_sale,p_items)
 ON CONFLICT(sale_id) DO NOTHING;
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION public.gw_pos_get_receipt_items(p_token text,p_sale text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_items jsonb;
BEGIN
 IF public.gw_employee_for_token(p_token) IS NULL THEN RAISE EXCEPTION 'Employee PIN required';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.gw_pos_sale_details(p_token,p_sale)) THEN RAISE EXCEPTION 'Verified sale not found';END IF;
 SELECT r.line_items INTO v_items FROM public.gw_pos_receipt_items r WHERE r.sale_id=p_sale;
 RETURN v_items;
END $$;
REVOKE ALL ON FUNCTION public.gw_pos_save_receipt_items(text,text,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gw_pos_get_receipt_items(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gw_pos_save_receipt_items(text,text,jsonb) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gw_pos_get_receipt_items(text,text) TO anon,authenticated;
COMMIT;
