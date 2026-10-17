-- Employee CID and employment dates. Boss PIN is required to edit.
BEGIN;
CREATE TABLE IF NOT EXISTS public.gw_employee_profiles(
 employee_id uuid PRIMARY KEY REFERENCES public.gw_employees(id) ON DELETE CASCADE,
 employee_cid text,
 hire_date date,
 last_promoted_date date,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gw_employee_profiles ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.gw_employee_profile_get(p_token text,p_employee uuid)
RETURNS TABLE(employee_cid text,hire_date date,last_promoted_date date)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF public.gw_employee_for_token(p_token) IS NULL THEN RAISE EXCEPTION 'Employee PIN required';END IF;
 IF NOT public.gw_mdt_can(p_token,'employees') AND NOT EXISTS(
  SELECT 1 FROM public.gw_employees WHERE id=public.gw_employee_for_token(p_token) AND role='Boss' AND active
 ) THEN RAISE EXCEPTION 'Employee access required';END IF;
 RETURN QUERY SELECT p.employee_cid,p.hire_date,p.last_promoted_date
 FROM public.gw_employee_profiles p WHERE p.employee_id=p_employee;
END $$;
CREATE OR REPLACE FUNCTION public.gw_employee_profile_save(
 p_token text,p_employee uuid,p_employee_name text,p_cid text,p_hire_date date,p_last_promoted_date date
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.gw_employees
 WHERE id=public.gw_employee_for_token(p_token) AND role='Boss' AND active)
 THEN RAISE EXCEPTION 'Boss PIN required';END IF;
 IF p_employee IS NULL OR NOT EXISTS(SELECT 1 FROM public.gw_employees WHERE id=p_employee)
 THEN RAISE EXCEPTION 'Employee not found';END IF;
 IF p_cid IS NOT NULL AND length(p_cid)>60 THEN RAISE EXCEPTION 'CID too long';END IF;
 INSERT INTO public.gw_employee_profiles(employee_id,employee_cid,hire_date,last_promoted_date,updated_at)
 VALUES(p_employee,nullif(btrim(p_cid),''),p_hire_date,p_last_promoted_date,now())
 ON CONFLICT(employee_id) DO UPDATE SET
 employee_cid=excluded.employee_cid,hire_date=excluded.hire_date,
 last_promoted_date=excluded.last_promoted_date,updated_at=now();
END $$;
REVOKE ALL ON FUNCTION public.gw_employee_profile_get(text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gw_employee_profile_save(text,uuid,text,text,date,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gw_employee_profile_get(text,uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gw_employee_profile_save(text,uuid,text,text,date,date) TO anon,authenticated;
COMMIT;