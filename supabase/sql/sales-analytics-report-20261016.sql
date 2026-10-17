-- Green Wonderland: range-aware analytical report. Read-only, permission checked.
-- Product/category revenue is BEFORE discounts; net revenue deducts refunds on adjustment date.
BEGIN;
CREATE OR REPLACE FUNCTION public.gw_mdt_analytics_report(p_token text,p_from timestamptz,p_to timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $analytics$
DECLARE v_result jsonb;
BEGIN
 IF NOT public.gw_mdt_can(p_token,'sales_earnings') THEN RAISE EXCEPTION 'Sales analytics access denied';END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_to<=p_from OR p_to>p_from+interval '370 days'
 THEN RAISE EXCEPTION 'Invalid analytics date range';END IF;
 WITH
 period_sales AS (
  SELECT s.id,s.employee_id,s.total,s.created_at FROM public.gw_sales s
  WHERE s.created_at>=p_from AND s.created_at<p_to
 ),
 period_adjustments AS (
  SELECT a.amount,a.created_at FROM public.gw_mdt_sale_adjustments a
  WHERE a.created_at>=p_from AND a.created_at<p_to
 ),
 sale_totals AS (
  SELECT coalesce(sum(total),0)::numeric gross,count(*)::integer orders FROM period_sales
 ),
 adjustment_totals AS (
  SELECT coalesce(sum(amount),0)::numeric refunded,count(*)::integer adjustments FROM period_adjustments
 ),
 product_rows AS (
  SELECT coalesce(nullif(btrim(item.value->>'name'),''),'Unknown product') product_name,
   coalesce(nullif(to_jsonb(p)->>'category',''), 'Uncategorized') category,
   greatest(0,coalesce((item.value->>'qty')::numeric,0)) qty,
   greatest(0,coalesce((item.value->>'total')::numeric,0)) line_total
  FROM period_sales s
  JOIN public.gw_sale_receipt_details d ON d.sale_id=s.id::text
  CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(d.items)='array' THEN d.items ELSE '[]'::jsonb END) item(value)
  LEFT JOIN public.products p ON p.id::text=item.value->>'id'
 ),
 daily_gross AS (
  SELECT (created_at AT TIME ZONE 'UTC')::date day,sum(total) gross,count(*) orders
  FROM period_sales GROUP BY 1
 ),
 daily_refunds AS (
  SELECT (created_at AT TIME ZONE 'UTC')::date day,sum(amount) refunded
  FROM period_adjustments GROUP BY 1
 ),
 monthly_gross AS (
  SELECT to_char(created_at AT TIME ZONE 'UTC','YYYY-MM') month,sum(total) gross,count(*) orders
  FROM period_sales GROUP BY 1
 ),
 monthly_refunds AS (
  SELECT to_char(created_at AT TIME ZONE 'UTC','YYYY-MM') month,sum(amount) refunded
  FROM period_adjustments GROUP BY 1
 )
 SELECT jsonb_build_object(
  'summary',(SELECT jsonb_build_object('gross',s.gross,'orders',s.orders,'refunds',a.refunded,'adjustments',a.adjustments,'net',s.gross-a.refunded)
    FROM sale_totals s CROSS JOIN adjustment_totals a),
  'employees',(SELECT coalesce(jsonb_agg(to_jsonb(z) ORDER BY z.revenue DESC), '[]'::jsonb) FROM (
    SELECT e.name employee_name,count(*)::integer orders,round(sum(s.total),2) revenue,
     round(avg(s.total),2) average_order
    FROM period_sales s JOIN public.gw_employees e ON e.id=s.employee_id
    GROUP BY e.id,e.name ORDER BY revenue DESC LIMIT 100
   ) z),
  'products',(SELECT coalesce(jsonb_agg(to_jsonb(z) ORDER BY z.units DESC), '[]'::jsonb) FROM (
    SELECT product_name,sum(qty)::numeric units,round(sum(line_total),2) gross_line_revenue
    FROM product_rows GROUP BY product_name ORDER BY units DESC LIMIT 100
   ) z),
  'categories',(SELECT coalesce(jsonb_agg(to_jsonb(z) ORDER BY z.gross_line_revenue DESC), '[]'::jsonb) FROM (
    SELECT category,sum(qty)::numeric units,round(sum(line_total),2) gross_line_revenue
    FROM product_rows GROUP BY category ORDER BY gross_line_revenue DESC LIMIT 100
   ) z),
  'daily',(SELECT coalesce(jsonb_agg(to_jsonb(z) ORDER BY z.day),'[]'::jsonb) FROM (
    SELECT coalesce(g.day,r.day) day,coalesce(g.gross,0) gross,coalesce(r.refunded,0) refunded,
     coalesce(g.gross,0)-coalesce(r.refunded,0) net,coalesce(g.orders,0) orders
    FROM daily_gross g FULL OUTER JOIN daily_refunds r USING(day)
   ) z),
  'monthly',(SELECT coalesce(jsonb_agg(to_jsonb(z) ORDER BY z.month),'[]'::jsonb) FROM (
    SELECT coalesce(g.month,r.month) month,coalesce(g.gross,0) gross,coalesce(r.refunded,0) refunded,
     coalesce(g.gross,0)-coalesce(r.refunded,0) net,coalesce(g.orders,0) orders
    FROM monthly_gross g FULL OUTER JOIN monthly_refunds r USING(month)
   ) z),
  'itemized_sales',(SELECT count(*) FROM period_sales s JOIN public.gw_sale_receipt_details d ON d.sale_id=s.id::text)
 ) INTO v_result;
 RETURN v_result;
END $analytics$;
REVOKE ALL ON FUNCTION public.gw_mdt_analytics_report(text,timestamptz,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gw_mdt_analytics_report(text,timestamptz,timestamptz) TO anon,authenticated;
COMMIT;