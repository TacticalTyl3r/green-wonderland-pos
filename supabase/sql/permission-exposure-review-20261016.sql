-- Green Wonderland POS — READ-ONLY permission exposure review
-- Run in Supabase SQL Editor. No data, permissions or configuration are changed.
-- Flags require human review: a public RPC may be intentionally exposed (checkout, login, public catalog).
WITH routine_review AS (
  SELECT
    'FUNCTION'::text AS object_type,
    p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS object_name,
    pg_get_userbyid(p.proowner) AS owner_name,
    p.prosecdef AS security_definer,
    has_function_privilege('anon',p.oid,'EXECUTE') AS anon_allowed,
    has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_allowed,
    EXISTS (
      SELECT 1 FROM unnest(coalesce(p.proargnames,array[]::text[])) arg
      WHERE arg = 'p_token'
    ) AS has_pin_token_argument,
    CASE
      WHEN p.prosecdef
        AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE'))
        AND NOT EXISTS (
          SELECT 1 FROM unnest(coalesce(p.proargnames,array[]::text[])) arg WHERE arg='p_token'
        )
      THEN 'REVIEW: Callable SECURITY DEFINER function without p_token parameter'
      WHEN p.prosecdef AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE'))
      THEN 'CHECK: Publicly callable; verify PIN/role enforcement in function body'
      ELSE 'Restricted or invoker-rights routine'
    END AS finding
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public'
    AND (p.proname LIKE 'gw_%' OR p.proname LIKE 'pos_%')
),
table_review AS (
  SELECT
    'TABLE'::text AS object_type,
    c.relname::text AS object_name,
    pg_get_userbyid(c.relowner) AS owner_name,
    false AS security_definer,
    (
      has_table_privilege('anon',c.oid,'SELECT')
      OR has_table_privilege('anon',c.oid,'INSERT')
      OR has_table_privilege('anon',c.oid,'UPDATE')
      OR has_table_privilege('anon',c.oid,'DELETE')
    ) AS anon_allowed,
    (
      has_table_privilege('authenticated',c.oid,'SELECT')
      OR has_table_privilege('authenticated',c.oid,'INSERT')
      OR has_table_privilege('authenticated',c.oid,'UPDATE')
      OR has_table_privilege('authenticated',c.oid,'DELETE')
    ) AS authenticated_allowed,
    false AS has_pin_token_argument,
    CASE
      WHEN NOT c.relrowsecurity
        AND (
          has_table_privilege('anon',c.oid,'SELECT') OR has_table_privilege('anon',c.oid,'INSERT')
          OR has_table_privilege('anon',c.oid,'UPDATE') OR has_table_privilege('anon',c.oid,'DELETE')
          OR has_table_privilege('authenticated',c.oid,'SELECT') OR has_table_privilege('authenticated',c.oid,'INSERT')
          OR has_table_privilege('authenticated',c.oid,'UPDATE') OR has_table_privilege('authenticated',c.oid,'DELETE')
        )
      THEN 'REVIEW: Table granted to API role without RLS'
      WHEN c.relrowsecurity THEN 'RLS enabled; inspect policies and grants'
      ELSE 'No API table privileges detected'
    END AS finding
  FROM pg_class c
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p','v')
    AND (c.relname LIKE 'gw_%' OR c.relname LIKE 'pos_%'
         OR c.relname IN ('products','app_settings','delivery_zones','employees','sales'))
)
SELECT object_type,object_name,owner_name,security_definer,
       anon_allowed,authenticated_allowed,has_pin_token_argument,finding
FROM (
 SELECT * FROM routine_review
 UNION ALL
 SELECT * FROM table_review
) audit
ORDER BY
 CASE WHEN finding LIKE 'REVIEW:%' THEN 0
      WHEN finding LIKE 'CHECK:%' THEN 1 ELSE 2 END,
 object_type,object_name;
