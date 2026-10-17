BEGIN;
CREATE OR REPLACE FUNCTION public.gw_former_employees(p_token text)
RETURNS TABLE(id uuid,name text,role text,employee_cid text,hire_date date,last_promoted_date date,separated_at timestamptz,separation_reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.gw_employees e WHERE e.id=public.gw_employee_for_token(p_token) AND e.active AND e.role='Boss')
 THEN RAISE EXCEPTION 'Boss PIN required';END IF;
 RETURN QUERY SELECT e.id,e.name,e.role,p.employee_cid,p.hire_date,p.last_promoted_date,
 (SELECT h.occurred_at FROM public.gw_employee_events h WHERE h.employee_id=e.id AND h.event_type='separation' ORDER BY h.occurred_at DESC LIMIT 1),
 (SELECT h.reason FROM public.gw_employee_events h WHERE h.employee_id=e.id AND h.event_type='separation' ORDER BY h.occurred_at DESC LIMIT 1)
 FROM public.gw_employees e LEFT JOIN public.gw_employee_profiles p ON p.employee_id=e.id
 WHERE NOT e.active ORDER BY e.name;
END $$;
CREATE OR REPLACE FUNCTION public.gw_employee_rehire(p_token text,p_employee uuid,p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e public.gw_employees%rowtype; actor uuid:=public.gw_employee_for_token(p_token); saved uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.gw_employees WHERE id=actor AND active AND role='Boss')
 THEN RAISE EXCEPTION 'Boss PIN required';END IF;
 IF length(btrim(coalesce(p_reason,'')))<5 THEN RAISE EXCEPTION 'Reactivation reason must be at least 5 characters';END IF;
 SELECT * INTO e FROM public.gw_employees WHERE id=p_employee FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Employee not found';END IF;
 IF e.active THEN RAISE EXCEPTION 'Employee is already active';END IF;
 saved:=public.gw_employee_manage_with_history(p_token,p_employee,e.name,e.role,NULL,true,p_reason);
 RETURN saved;
END $$;
REVOKE ALL ON FUNCTION public.gw_former_employees(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gw_employee_rehire(text,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gw_former_employees(text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gw_employee_rehire(text,uuid,text) TO anon,authenticated;
COMMIT;