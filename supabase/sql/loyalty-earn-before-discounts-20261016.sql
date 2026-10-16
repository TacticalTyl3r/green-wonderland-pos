-- Earn loyalty points from the pre-discount merchandise subtotal.
-- Specials, manual discounts and points redemption do not reduce the earning base.
-- Preserve the existing configured earning rate and enabled switch.
DO $migration$
DECLARE
 v_signature regprocedure := to_regprocedure('public.gw_pos_checkout_v4(text,uuid,jsonb,text,text,numeric,uuid,integer,numeric)');
 v_source text;
 v_updated text;
 v_old text := 'floor(greatest(v_sub-v_off-v_manual-v_reward,0)/c.earn_per_amount)';
 v_new text := 'floor(greatest(v_sub,0)/c.earn_per_amount)';
BEGIN
 IF v_signature IS NULL THEN RAISE EXCEPTION 'Verified checkout function not found; no changes made'; END IF;
 v_source := pg_get_functiondef(v_signature);
 IF position(v_new IN v_source)>0 THEN
  RAISE NOTICE 'Loyalty points already earn on the pre-discount subtotal';
  RETURN;
 END IF;
 IF position(v_old IN v_source)=0 THEN
  RAISE EXCEPTION 'Checkout earning calculation differs from expected version; no changes made';
 END IF;
 v_updated := replace(v_source,v_old,v_new);
 EXECUTE v_updated;
 RAISE NOTICE 'Loyalty points now earn from the pre-discount subtotal';
END $migration$;
