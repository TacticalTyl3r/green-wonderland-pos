-- Green Wonderland POS: Permissions & Audit Logs, phase 1 (2026-10-16)
-- Adds automatic server-side management activity; does not alter login, clock-in, checkout or permissions.
-- Run only once after existing MDT activity and loyalty/refund migrations.
BEGIN;

-- Attribute changes made by the Boss PIN permission editor to the actual employee.
-- The transaction-local setting is populated only after the secure Boss PIN check succeeds.
CREATE OR REPLACE FUNCTION public.gw_mdt_permission_activity_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $audit_permission$
BEGIN
 IF tg_op='UPDATE' AND new.allowed IS NOT DISTINCT FROM old.allowed THEN RETURN new;END IF;
 INSERT INTO public.gw_mdt_activity_log(action,subject,details,actor)
 VALUES(
  'Permission changed',new.role,
  new.feature||': '||CASE WHEN new.allowed THEN 'Enabled' ELSE 'Disabled' END,
  coalesce(nullif(current_setting('gw.audit_actor',true),''),'System / administrative session')
 );
 RETURN new;
END $audit_permission$;

CREATE OR REPLACE FUNCTION public.gw_boss_set_role_permission(
 p_token text,p_role text,p_feature text,p_allowed boolean
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $boss_permission$
DECLARE v_actor text;
BEGIN
 IF NOT public.gw_boss_pin_check(p_token) THEN RAISE EXCEPTION 'Boss employee PIN required';END IF;
 IF p_role NOT IN ('Manager','Senior Salesman','Salesman') THEN RAISE EXCEPTION 'Cannot change Boss permissions';END IF;
 IF p_allowed IS NULL THEN RAISE EXCEPTION 'Choose enabled or disabled';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.gw_mdt_role_permissions r WHERE r.feature=p_feature)
 THEN RAISE EXCEPTION 'Unknown permission';END IF;
 SELECT e.name INTO v_actor
 FROM public.gw_employees e WHERE e.id=public.gw_employee_for_token(p_token) AND e.active AND e.role='Boss';
 IF v_actor IS NULL THEN RAISE EXCEPTION 'Boss employee PIN required';END IF;
 PERFORM set_config('gw.audit_actor',v_actor,true);
 INSERT INTO public.gw_mdt_role_permissions(role,feature,allowed,updated_at)
 VALUES(p_role,p_feature,p_allowed,now())
 ON CONFLICT(role,feature) DO UPDATE SET allowed=excluded.allowed,updated_at=now();
END $boss_permission$;

-- Audit refunds and voids, capturing both the employee and the stated reason.
CREATE OR REPLACE FUNCTION public.gw_audit_sale_adjustment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $sale_audit$
BEGIN
 INSERT INTO public.gw_mdt_activity_log(action,subject,details,actor)
 VALUES(
  CASE WHEN new.adjustment_type='void' THEN 'Sale voided' ELSE 'Sale refunded' END,
  'Sale '||new.sale_id,
  'Amount: $'||new.amount::text||'; Reason: '||new.reason,
  coalesce(nullif(new.performed_by,''),'Unknown employee')
 );
 RETURN new;
END $sale_audit$;
DROP TRIGGER IF EXISTS gw_audit_sale_adjustment_insert ON public.gw_mdt_sale_adjustments;
CREATE TRIGGER gw_audit_sale_adjustment_insert AFTER INSERT ON public.gw_mdt_sale_adjustments
 FOR EACH ROW EXECUTE FUNCTION public.gw_audit_sale_adjustment();

-- Record manual loyalty point adjustments, but not purchase earning/spending or refund
-- reconciliations (refund/void is already recorded above).
CREATE OR REPLACE FUNCTION public.gw_audit_manual_loyalty_points()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $loyalty_audit$
DECLARE v_cid text;v_actor text;
BEGIN
 IF new.note IS NULL OR new.note NOT LIKE 'Manual adjustment:%' THEN RETURN new;END IF;
 SELECT m.member_code INTO v_cid FROM public.gw_loyalty_members m WHERE m.id=new.member_id;
 SELECT e.name INTO v_actor FROM public.gw_employees e WHERE e.id=new.performed_by;
 INSERT INTO public.gw_mdt_activity_log(action,subject,details,actor)
 VALUES('Loyalty points adjusted','Customer CID '||coalesce(v_cid,'Unknown'),
  'Points: '||CASE WHEN new.points_delta>0 THEN '+' ELSE '' END||new.points_delta::text||
  '; '||new.note,coalesce(v_actor,'System'));
 RETURN new;
END $loyalty_audit$;
DROP TRIGGER IF EXISTS gw_audit_manual_loyalty_insert ON public.gw_loyalty_ledger;
CREATE TRIGGER gw_audit_manual_loyalty_insert AFTER INSERT ON public.gw_loyalty_ledger
 FOR EACH ROW EXECUTE FUNCTION public.gw_audit_manual_loyalty_points();

-- Include catalog reward redemptions in the searchable audit feed.
CREATE OR REPLACE FUNCTION public.gw_audit_catalog_reward_redemption()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $catalog_audit$
DECLARE v_cid text;v_actor text;
BEGIN
 SELECT m.member_code INTO v_cid FROM public.gw_loyalty_members m WHERE m.id=new.member_id;
 SELECT e.name INTO v_actor FROM public.gw_employees e WHERE e.id=new.employee_id;
 INSERT INTO public.gw_mdt_activity_log(action,subject,details,actor)
 VALUES('Loyalty reward redeemed','Customer CID '||coalesce(v_cid,'Unknown'),
  coalesce(new.reward_title,'Reward')||'; Points spent: '||new.points_spent::text,
  coalesce(v_actor,'Unknown employee'));
 RETURN new;
END $catalog_audit$;
DROP TRIGGER IF EXISTS gw_audit_catalog_redemption_insert ON public.gw_loyalty_catalog_redemptions;
CREATE TRIGGER gw_audit_catalog_redemption_insert AFTER INSERT ON public.gw_loyalty_catalog_redemptions
 FOR EACH ROW EXECUTE FUNCTION public.gw_audit_catalog_reward_redemption();

-- Capture staff promotions, departures and rehires with the recorded actor/reason.
CREATE OR REPLACE FUNCTION public.gw_audit_employee_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $staff_audit$
DECLARE v_employee text;v_actor text;
BEGIN
 SELECT e.name INTO v_employee FROM public.gw_employees e WHERE e.id=new.employee_id;
 SELECT e.name INTO v_actor FROM public.gw_employees e WHERE e.id=new.actor_id;
 INSERT INTO public.gw_mdt_activity_log(action,subject,details,actor)
 VALUES(
  CASE new.event_type
   WHEN 'promotion' THEN 'Employee promoted'
   WHEN 'separation' THEN 'Employee separated'
   WHEN 'rehire' THEN 'Employee rehired'
   ELSE 'Employee role changed' END,
  coalesce(v_employee,'Employee'),
  concat_ws('; ',
   CASE WHEN new.old_role IS DISTINCT FROM new.new_role THEN coalesce(new.old_role,'Unknown')||' → '||coalesce(new.new_role,'Unknown') END,
   CASE WHEN nullif(btrim(coalesce(new.reason,'')),'') IS NOT NULL THEN 'Reason: '||btrim(new.reason) END),
  coalesce(v_actor,'Unknown employee')
 );
 RETURN new;
END $staff_audit$;
DROP TRIGGER IF EXISTS gw_audit_employee_event_insert ON public.gw_employee_events;
CREATE TRIGGER gw_audit_employee_event_insert AFTER INSERT ON public.gw_employee_events
 FOR EACH ROW EXECUTE FUNCTION public.gw_audit_employee_event();

-- Keep raw audit history private; authorized employee PIN RPCs remain the only reader.
ALTER TABLE public.gw_mdt_activity_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gw_mdt_activity_log FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.gw_boss_set_role_permission(text,text,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gw_boss_set_role_permission(text,text,text,boolean) TO anon,authenticated;
COMMIT;
