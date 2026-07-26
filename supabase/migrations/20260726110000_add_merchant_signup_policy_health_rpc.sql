-- Detect policy/grant drift that can break merchant INSERT ... RETURNING.
CREATE OR REPLACE FUNCTION public.get_merchant_signup_policy_health()
RETURNS jsonb LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object(
    'row_level_security_enabled', COALESCE((
      SELECT relation.relrowsecurity FROM pg_catalog.pg_class AS relation
      WHERE relation.oid = 'public.merchants'::pg_catalog.regclass
    ), FALSE),
    'alias_row_level_security_enabled', COALESCE((
      SELECT relation.relrowsecurity FROM pg_catalog.pg_class AS relation
      WHERE relation.oid = 'public.merchant_slug_aliases'::pg_catalog.regclass
    ), FALSE),
    'alias_select_policy_is_expected', EXISTS (
      SELECT 1
      FROM pg_catalog.pg_policy AS policy
      WHERE policy.polrelid =
          'public.merchant_slug_aliases'::pg_catalog.regclass
        AND policy.polname = 'slug aliases are publicly readable'
        AND policy.polcmd = 'r'
        AND policy.polpermissive IS TRUE
        AND pg_catalog.cardinality(policy.polroles) = 2
        AND (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'anon')
          = ANY(policy.polroles)
        AND (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'authenticated')
          = ANY(policy.polroles)
        AND pg_catalog.lower(pg_catalog.btrim(
          pg_catalog.pg_get_expr(policy.polqual, policy.polrelid)
        )) = 'true'
    ),
    'no_restrictive_alias_select_policies', NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_policy AS policy
      WHERE policy.polrelid =
          'public.merchant_slug_aliases'::pg_catalog.regclass
        AND policy.polpermissive IS FALSE
        AND policy.polcmd IN ('*', 'r')
        AND (
          0::pg_catalog.oid = ANY(policy.polroles)
          OR EXISTS (
            SELECT 1
            FROM pg_catalog.unnest(policy.polroles) AS assigned_role(oid)
            WHERE assigned_role.oid <> 0::pg_catalog.oid
              AND (pg_catalog.pg_has_role('anon', assigned_role.oid, 'USAGE')
                OR pg_catalog.pg_has_role(
                  'authenticated', assigned_role.oid, 'USAGE'
                ))
          )
        )
    ),
    'anon_select_policy_is_expected', EXISTS (
      SELECT 1
      FROM pg_catalog.pg_policy AS policy
      WHERE policy.polrelid = 'public.merchants'::pg_catalog.regclass
        AND policy.polname = 'Anon can view merchants'
        AND policy.polcmd = 'r'
        AND policy.polpermissive IS TRUE
        AND policy.polroles = ARRAY[
          (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'anon')
        ]
        AND pg_catalog.lower(pg_catalog.regexp_replace(
          pg_catalog.pg_get_expr(policy.polqual, policy.polrelid),
          '[[:space:]()]', '', 'g'
        )) = 'is_publishedistrue'
        AND pg_catalog.pg_get_expr(policy.polqual, policy.polrelid)
          !~* '(^|[^[:alnum:]_])(NOT|AND|OR)([^[:alnum:]_]|$)'
    ),
    'select_policy_is_expected', EXISTS (
      SELECT 1
      FROM pg_catalog.pg_policy AS policy
      WHERE policy.polrelid = 'public.merchants'::pg_catalog.regclass
        AND policy.polname = 'Authenticated can view merchants'
        AND policy.polcmd = 'r'
        AND policy.polpermissive IS TRUE
        AND policy.polroles = ARRAY[
          (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'authenticated')
        ]
        AND pg_catalog.pg_get_expr(policy.polqual, policy.polrelid)
          ~* 'user_id[[:space:]]*=[[:space:]]*[(]?[[:space:]]*SELECT[[:space:]]+auth[.]uid[(][)]'
        AND pg_catalog.pg_get_expr(policy.polqual, policy.polrelid)
          ~* 'is_published[[:space:]]+IS[[:space:]]+TRUE'
        AND pg_catalog.pg_get_expr(policy.polqual, policy.polrelid)
          ~* '(public[.])?has_merchant_access[(]id[)]'
        AND pg_catalog.lower(pg_catalog.regexp_replace(
          pg_catalog.regexp_replace(
            pg_catalog.pg_get_expr(policy.polqual, policy.polrelid),
            '(SELECT|AS[[:space:]]+uid|public[.])',
            '',
            'gi'
          ),
          '[[:space:]()]',
          '',
          'g'
        )) = 'is_publishedistrueoruser_id=auth.uidorhas_merchant_accessid'
        AND pg_catalog.pg_get_expr(policy.polqual, policy.polrelid)
          !~* '(^|[^[:alnum:]_])(NOT|AND)([^[:alnum:]_]|$)'
        AND (
          SELECT pg_catalog.count(*)
          FROM pg_catalog.regexp_matches(
            pg_catalog.pg_get_expr(policy.polqual, policy.polrelid),
            '(^|[^[:alnum:]_])OR([^[:alnum:]_]|$)',
            'gi'
          )
        ) = 2
    ),
    'insert_policy_allows_owner', EXISTS (
      SELECT 1
      FROM pg_catalog.pg_policy AS policy
      WHERE policy.polrelid = 'public.merchants'::pg_catalog.regclass
        AND policy.polname = 'Owner and staff can modify merchants'
        AND policy.polcmd = 'a'
        AND policy.polpermissive IS TRUE
        AND policy.polroles = ARRAY[0::pg_catalog.oid]
        AND pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid)
          ~* 'user_id[[:space:]]*=[[:space:]]*[(]?[[:space:]]*SELECT[[:space:]]+([(][[:space:]]*SELECT[[:space:]]+)?auth[.]uid[(][)]'
        AND pg_catalog.lower(pg_catalog.regexp_replace(
          pg_catalog.regexp_replace(
            pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid),
            '(SELECT|AS[[:space:]]+uid)',
            '',
            'gi'
          ),
          '[[:space:]()]',
          '',
          'g'
        )) = 'user_id=auth.uid'
        AND pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid)
          !~* '(^|[^[:alnum:]_])(NOT|AND|OR)([^[:alnum:]_]|$)'
    ),
    'update_policy_allows_owner_or_staff', EXISTS (
      SELECT 1
      FROM pg_catalog.pg_policy AS policy
      WHERE policy.polrelid = 'public.merchants'::pg_catalog.regclass
        AND policy.polname = 'Consolidated update permissions'
        AND policy.polcmd = 'w'
        AND policy.polpermissive IS TRUE
        AND policy.polroles = ARRAY[0::pg_catalog.oid]
        AND policy.polwithcheck IS NULL
        AND pg_catalog.regexp_replace(
          pg_catalog.regexp_replace(
            pg_catalog.pg_get_expr(policy.polqual, policy.polrelid),
            '(SELECT|AS[[:space:]]+uid|public[.]|::text)',
            '',
            'gi'
          ),
          '[[:space:]()''"]',
          '',
          'g'
        ) = 'user_id=auth.uidORcheck_staff_permissionauth.uid,id,settings,edit'
    ),
    'no_restrictive_signup_policies', NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_policy AS policy
      WHERE policy.polrelid = 'public.merchants'::pg_catalog.regclass
        AND policy.polpermissive IS FALSE
        AND policy.polcmd IN ('*', 'r', 'a', 'w')
        AND (
          0::pg_catalog.oid = ANY(policy.polroles)
          OR EXISTS (
            SELECT 1
            FROM pg_catalog.unnest(policy.polroles) AS assigned_role(oid)
            WHERE assigned_role.oid <> 0::pg_catalog.oid
              AND pg_catalog.pg_has_role(
                'authenticated', assigned_role.oid, 'USAGE'
              )
          )
        )
    ),
    'no_restrictive_anon_merchant_select_policies', NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_policy AS policy
      WHERE policy.polrelid = 'public.merchants'::pg_catalog.regclass
        AND policy.polpermissive IS FALSE
        AND policy.polcmd IN ('*', 'r')
        AND (
          0::pg_catalog.oid = ANY(policy.polroles)
          OR EXISTS (
            SELECT 1
            FROM pg_catalog.unnest(policy.polroles) AS assigned_role(oid)
            WHERE assigned_role.oid <> 0::pg_catalog.oid
              AND pg_catalog.pg_has_role('anon', assigned_role.oid, 'USAGE')
          )
        )
    ),
    'no_unexpected_permissive_anon_merchant_select_policies', NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_policy AS policy
      WHERE policy.polrelid = 'public.merchants'::pg_catalog.regclass
        AND policy.polpermissive IS TRUE
        AND policy.polcmd IN ('*', 'r')
        AND (
          0::pg_catalog.oid = ANY(policy.polroles)
          OR EXISTS (
            SELECT 1
            FROM pg_catalog.unnest(policy.polroles) AS assigned_role(oid)
            WHERE assigned_role.oid <> 0::pg_catalog.oid
              AND pg_catalog.pg_has_role('anon', assigned_role.oid, 'USAGE')
          )
        )
        AND NOT (policy.polcmd = 'r'
          AND policy.polname = 'Anon can view merchants')
    ),
    'no_unexpected_permissive_signup_policies', NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_policy AS policy
      WHERE policy.polrelid = 'public.merchants'::pg_catalog.regclass
        AND policy.polpermissive IS TRUE
        AND policy.polcmd IN ('*', 'r', 'a', 'w')
        AND (
          0::pg_catalog.oid = ANY(policy.polroles)
          OR EXISTS (
            SELECT 1
            FROM pg_catalog.unnest(policy.polroles) AS assigned_role(oid)
            WHERE assigned_role.oid <> 0::pg_catalog.oid
              AND pg_catalog.pg_has_role(
                'authenticated', assigned_role.oid, 'USAGE'
              )
          )
        )
        AND NOT (
          (policy.polcmd = 'r'
            AND policy.polname = 'Authenticated can view merchants')
          OR (policy.polcmd = 'a'
            AND policy.polname = 'Owner and staff can modify merchants')
          OR (policy.polcmd = 'w'
            AND policy.polname = 'Consolidated update permissions')
        )
    ),
    'auth_can_use_public_schema', pg_catalog.has_schema_privilege(
      'authenticated', 'public', 'USAGE'
    ),
    'anon_can_use_public_schema', pg_catalog.has_schema_privilege(
      'anon', 'public', 'USAGE'
    ),
    'auth_can_insert', pg_catalog.has_table_privilege(
      'authenticated', 'public.merchants', 'INSERT'
    ),
    'auth_can_update', pg_catalog.has_table_privilege(
      'authenticated', 'public.merchants', 'UPDATE'
    ),
    'auth_has_no_table_select', NOT pg_catalog.has_table_privilege(
      'authenticated', 'public.merchants', 'SELECT'
    ),
    'can_read_id', pg_catalog.has_column_privilege(
      'authenticated', 'public.merchants', 'id', 'SELECT'
    ),
    'can_read_slug', pg_catalog.has_column_privilege(
      'authenticated', 'public.merchants', 'slug', 'SELECT'
    ),
    'can_read_business_name', pg_catalog.has_column_privilege(
      'authenticated', 'public.merchants', 'business_name', 'SELECT'
    ),
    'can_read_user_id', pg_catalog.has_column_privilege(
      'authenticated', 'public.merchants', 'user_id', 'SELECT'
    ),
    'anon_can_read_merchant_id', pg_catalog.has_column_privilege(
      'anon', 'public.merchants', 'id', 'SELECT'
    ),
    'anon_can_read_merchant_slug', pg_catalog.has_column_privilege(
      'anon', 'public.merchants', 'slug', 'SELECT'
    ),
    'anon_has_no_merchant_table_select', NOT pg_catalog.has_table_privilege(
      'anon', 'public.merchants', 'SELECT'
    ),
    'anon_can_read_alias_old_slug', pg_catalog.has_column_privilege(
      'anon', 'public.merchant_slug_aliases', 'old_slug', 'SELECT'
    ),
    'anon_can_read_alias_merchant_id', pg_catalog.has_column_privilege(
      'anon', 'public.merchant_slug_aliases', 'merchant_id', 'SELECT'
    ),
    'anon_has_no_alias_table_select', NOT pg_catalog.has_table_privilege(
      'anon', 'public.merchant_slug_aliases', 'SELECT'
    ),
    'auth_can_read_alias_old_slug', pg_catalog.has_column_privilege(
      'authenticated', 'public.merchant_slug_aliases', 'old_slug', 'SELECT'
    ),
    'auth_can_read_alias_merchant_id', pg_catalog.has_column_privilege(
      'authenticated', 'public.merchant_slug_aliases', 'merchant_id', 'SELECT'
    ),
    'auth_has_no_alias_table_select', NOT pg_catalog.has_table_privilege(
      'authenticated', 'public.merchant_slug_aliases', 'SELECT'
    ),
    'auth_can_execute_reserved_slug_check', pg_catalog.has_function_privilege(
      'authenticated', 'public.is_reserved_merchant_slug(text)', 'EXECUTE'
    ),
    'auth_can_execute_slug_generator', pg_catalog.has_function_privilege(
      'authenticated', 'public.generate_slug(text)', 'EXECUTE'
    )
  );
$$;

REVOKE ALL ON FUNCTION public.get_merchant_signup_policy_health() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_merchant_signup_policy_health()
  FROM authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_merchant_signup_policy_health() TO anon;
