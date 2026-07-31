-- Trigger WHEN expressions run with the statement role's function privileges.
-- The pure predicate helpers must be executable by merchant writers while the
-- private schema and all anonymous/PUBLIC execution remain denied.
DO $test$
DECLARE
  v_helper regprocedure;
BEGIN
  FOREACH v_helper IN ARRAY ARRAY[
    'private.merchant_identity_audit_row_is_bounded_v2(public.merchants)'::regprocedure,
    'private.project_merchant_social_media_for_audit_v1(jsonb)'::regprocedure
  ] LOOP
    IF NOT pg_catalog.has_function_privilege(
      'authenticated', v_helper, 'EXECUTE'
    ) OR NOT pg_catalog.has_function_privilege(
      'service_role', v_helper, 'EXECUTE'
    ) THEN
      RAISE EXCEPTION 'merchant identity trigger predicate helper is unavailable to writer roles';
    END IF;

    IF pg_catalog.has_function_privilege('anon', v_helper, 'EXECUTE')
       OR EXISTS (
         SELECT 1
         FROM pg_catalog.pg_proc AS function_definition
         CROSS JOIN LATERAL pg_catalog.aclexplode(
           COALESCE(
             function_definition.proacl,
             pg_catalog.acldefault('f', function_definition.proowner)
           )
         ) AS function_acl
         WHERE function_definition.oid = v_helper::oid
           AND function_acl.grantee = 0
           AND function_acl.privilege_type = 'EXECUTE'
       ) THEN
      RAISE EXCEPTION 'merchant identity trigger predicate helper is anonymously executable';
    END IF;
  END LOOP;

  IF pg_catalog.has_schema_privilege('authenticated', 'private', 'USAGE') THEN
    RAISE EXCEPTION 'authenticated must not have direct private schema access';
  END IF;
END;
$test$;
