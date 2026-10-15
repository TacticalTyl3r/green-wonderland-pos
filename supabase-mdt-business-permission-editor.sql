-- Run after supabase-mdt-business-reports.sql
create or replace function public.gw_mdt_set_role_permission(p_role text,p_feature text,p_allowed boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.gw_is_boss() then raise exception 'Boss access required'; end if;
 if p_role not in ('Manager','Senior Salesman','Salesman') or p_feature not in
 ('dashboard','employees','time_management','sales_earnings','admin_catalog','admin_branding',
 'employee_add','employee_edit','employee_deactivate','employee_role_assign','employee_pin_reset',
 'time_add','time_remove','time_history','sales_history','announcements','announcements_manage',
 'employee_notes','employee_notes_manage') or p_allowed is null then raise exception 'Invalid permission'; end if;
 insert into public.gw_mdt_role_permissions(role,feature,allowed,updated_at)
 values(p_role,p_feature,p_allowed,now())
 on conflict(role,feature) do update set allowed=excluded.allowed,updated_at=now();
end$$;