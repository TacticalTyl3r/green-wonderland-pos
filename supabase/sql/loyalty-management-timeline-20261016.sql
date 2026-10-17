-- Green Wonderland: Loyalty oversight and manual-adjustment safeguards.
-- Additive reporting; existing checkout, redemption and refund procedures are unchanged.
BEGIN;
CREATE OR REPLACE FUNCTION public.gw_loyalty_adjust_points(p_token text,p_member uuid,p_delta integer,p_reason text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $point_adjust$
DECLARE v_actor uuid; v_points integer; v_before integer;
BEGIN
 IF NOT public.gw_mdt_can(p_token,'loyalty_adjust') THEN RAISE EXCEPTION 'Loyalty adjustment access denied'; END IF;
 v_actor:=public.gw_employee_for_token(p_token);
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.gw_employees e WHERE e.id=v_actor AND e.active)
 THEN RAISE EXCEPTION 'Sign in with an active employee PIN';END IF;
 IF p_delta IS NULL OR p_delta=0 OR abs(p_delta)>10000 THEN RAISE EXCEPTION 'Enter a nonzero point adjustment up to 10000';END IF;
 IF length(btrim(coalesce(p_reason,''))) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'Reason must be 5 to 500 characters';END IF;
 SELECT m.points INTO v_before FROM public.gw_loyalty_members m WHERE m.id=p_member FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Loyalty member not found';END IF;
 -- Refund reconciliation is allowed to create negative balances, but manual reductions cannot create or deepen them.
 IF p_delta<0 AND (v_before<0 OR v_before+p_delta<0)
 THEN RAISE EXCEPTION 'Cannot remove more available points than the member holds';END IF;
 UPDATE public.gw_loyalty_members SET points=points+p_delta WHERE id=p_member RETURNING points INTO v_points;
 INSERT INTO public.gw_loyalty_ledger(member_id,points_delta,note,performed_by)
 VALUES(p_member,p_delta,'Manual adjustment: '||btrim(p_reason),v_actor);
 RETURN v_points;
END $point_adjust$;

CREATE OR REPLACE FUNCTION public.gw_loyalty_management_timeline(p_token text,p_member uuid)
RETURNS TABLE(event_id text,event_type text,event_date timestamptz,description text,points_change integer,performed_by text,reference text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $loyalty_timeline$
BEGIN
 IF NOT public.gw_mdt_can(p_token,'loyalty_view') AND NOT public.gw_mdt_can(p_token,'loyalty_adjust')
 THEN RAISE EXCEPTION 'Loyalty management access denied';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.gw_loyalty_members m WHERE m.id=p_member)
 THEN RAISE EXCEPTION 'Loyalty member not found';END IF;
 RETURN QUERY
 SELECT results.event_id,results.event_type,results.event_date,results.description,results.points_change,results.performed_by,results.reference
 FROM (
  SELECT ('ledger:'||l.id::text)::text AS event_id,
   (CASE WHEN l.note LIKE 'Manual adjustment:%' THEN 'manual_adjustment'
    WHEN l.note LIKE 'Points reversed for %' OR l.note LIKE 'Redeemed points restored for %' THEN 'refund_reconciliation'
    WHEN l.points_delta<0 THEN 'points_spent' ELSE 'points_earned' END)::text AS event_type,
   l.created_at AS event_date,l.note::text AS description,l.points_delta::integer AS points_change,
   coalesce(e.name,'System')::text AS performed_by,l.sale_id::text AS reference
  FROM public.gw_loyalty_ledger l LEFT JOIN public.gw_employees e ON e.id=l.performed_by
  WHERE l.member_id=p_member
  UNION ALL
  SELECT ('catalog:'||c.id::text)::text,'catalog_redemption'::text,c.created_at,c.reward_title::text,
   -c.points_spent::integer,coalesce(e.name,'Unknown employee')::text,c.id::text
  FROM public.gw_loyalty_catalog_redemptions c LEFT JOIN public.gw_employees e ON e.id=c.employee_id
  WHERE c.member_id=p_member
 ) results
 ORDER BY results.event_date DESC,results.event_id DESC LIMIT 500;
END $loyalty_timeline$;
REVOKE ALL ON FUNCTION public.gw_loyalty_adjust_points(text,uuid,integer,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gw_loyalty_management_timeline(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gw_loyalty_adjust_points(text,uuid,integer,text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gw_loyalty_management_timeline(text,uuid) TO anon,authenticated;
COMMIT;