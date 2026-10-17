BEGIN;
ALTER TABLE public.gw_employee_profiles ALTER COLUMN hire_date SET DEFAULT CURRENT_DATE;
CREATE OR REPLACE FUNCTION public.gw_employee_initial_hire_date()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 INSERT INTO public.gw_employee_profiles(employee_id,hire_date)
 VALUES(NEW.id,CURRENT_DATE)
 ON CONFLICT(employee_id) DO NOTHING;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS gw_employee_initial_hire_date_trigger ON public.gw_employees;
CREATE TRIGGER gw_employee_initial_hire_date_trigger
AFTER INSERT ON public.gw_employees
FOR EACH ROW EXECUTE FUNCTION public.gw_employee_initial_hire_date();
COMMIT;