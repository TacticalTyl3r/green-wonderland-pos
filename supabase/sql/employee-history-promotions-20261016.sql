-- Staff employment history, reasons for separation, and automatic promotion dates.
BEGIN;
CREATE TABLE IF NOT EXISTS public.gw_employee_events(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 employee_id uuid NOT NULL REFERENCES public.gw_employees(id) ON DELETE CASCADE,
 actor_id uuid REFERENCES public.gw_employees(id) ON DELETE SET NULL,
 event_type text NOT NULL CHECK(event_type IN ('promotion','role_change','separation','rehire')),
 old_role text,new_role text,reason text,
 occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gw_employee_events_employee_idx ON public.gw_employee_events(employee_id,occurred_at DESC);
ALTER TABLE public.gw_employee_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.gw_employee_manage_with_history(
 p_token text,p_id uuid,p_name text,p_role text,p_pin text,p_active boolean,p_reason text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 actor uuid:=public.gw_employee_for_token(p_token);
 actor_role text;
 previous public.gw_employees%rowtype;
 saved uuid;
 old_rank int;
 new_rank int;
 event_kind text;
BEGIN
 SELECT role INTO actor_role FROM public.gw_employees WHERE id=actor AND active;
 IF actor_role IS NULL THEN RAISE EXCEPTION 'Employee PIN session required';END IF;
 IF p_id IS NOT NULL THEN
  SELECT * INTO previous FROM public.gw_employees WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Employee not found';END IF;
 END IF;
 IF p_id IS NOT NULL AND previous.active AND NOT p_active THEN
  IF actor_role<>'Boss' THEN RAISE EXCEPTION 'Boss PIN required to separate employees';END IF;
  IF p_reason IS NULL OR length(btrim(p_reason))<5 THEN
   RAISE EXCEPTION 'A separation reason of at least 5 characters is required';END IF;
 END IF;
 saved:=public.gw_mdt_manage_employee(p_token,p_id,p_name,p_role,p_pin,p_active);
 IF p_id IS NOT NULL THEN
  IF previous.active AND NOT p_active THEN
   event_kind:='separation';
  ELSIF NOT previous.active AND p_active THEN
   event_kind:='rehire';
  ELSIF previous.role IS DISTINCT FROM p_role THEN
   old_rank:=CASE previous.role WHEN 'Boss' THEN 4 WHEN 'Manager' THEN 3 WHEN 'Senior Salesman' THEN 2 ELSE 1 END;
   new_rank:=CASE p_role WHEN 'Boss' THEN 4 WHEN 'Manager' THEN 3 WHEN 'Senior Salesman' THEN 2 ELSE 1 END;
   event_kind:=CASE WHEN new_rank>old_rank THEN 'promotion' ELSE 'role_change' END;
  END IF;
  IF event_kind IS NOT NULL THEN
   INSERT INTO public.gw_employee_events(employee_id,actor_id,event_type,old_role,new_role,reason)
   VALUES(saved,actor,event_kind,previous.role,p_role,nullif(btrim(p_reason),''));
   IF event_kind='promotion' THEN
    INSERT INTO public.gw_employee_profiles(employee_id,last_promoted_date)
    VALUES(saved,current_date)
    ON CONFLICT(employee_id) DO UPDATE SET last_promoted_date=current_date,updated_at=now();
   END IF;
  END IF;
 END IF;
 RETURN saved;
END $$;

CREATE OR REPLACE FUNCTION public.gw_employee_history(p_token text,p_employee uuid DEFAULT NULL)
RETURNS TABLE(id bigint,employee_id uuid,employee_name text,employee_cid text,
 event_type text,old_role text,new_role text,reason text,occurred_at timestamptz,actor_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.gw_employees
 WHERE public.gw_employees.id=public.gw_employee_for_token(p_token) AND role='Boss' AND active)
 THEN RAISE EXCEPTION 'Boss PIN required';END IF;
 RETURN QUERY SELECT h.id,h.employee_id,e.name,p.employee_cid,h.event_type,
 h.old_role,h.new_role,h.reason,h.occurred_at,a.name
 FROM public.gw_employee_events h
 JOIN public.gw_employees e ON e.id=h.employee_id
 LEFT JOIN public.gw_employee_profiles p ON p.employee_id=e.id
 LEFT JOIN public.gw_employees a ON a.id=h.actor_id
 WHERE p_employee IS NULL OR h.employee_id=p_employee
 ORDER BY h.occurred_at DESC,h.id DESC LIMIT 1000;
END $$;
REVOKE ALL ON FUNCTION public.gw_employee_manage_with_history(text,uuid,text,text,text,boolean,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gw_employee_history(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gw_employee_manage_with_history(text,uuid,text,text,text,boolean,text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gw_employee_history(text,uuid) TO anon,authenticated;
COMMIT;