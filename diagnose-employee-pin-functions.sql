-- Run this diagnostic only; it does not modify data.
select proname, pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('gw_pin_me','gw_pin_login')
order by proname;
