-- Storefront snapshot function and privilege contracts.

DO $setup$
BEGIN
  IF pg_catalog.to_regclass(
    'public.idx_domains_active_lower_domain'
  ) IS NULL THEN
    RAISE EXCEPTION
      'active-domain resolvers lost their lower(domain) partial index';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS proc
    WHERE proc.oid = (
      'private.get_storefront_pdp_core_v2(uuid,text,uuid)'
    )::pg_catalog.regprocedure
      AND proc.prosecdef
      AND proc.provolatile = 's'
      AND EXISTS (
        SELECT 1
        FROM pg_catalog.pg_options_to_table(
          COALESCE(proc.proconfig, ARRAY[]::text[])
        ) AS config
        WHERE config.option_name = 'search_path'
          AND pg_catalog.btrim(config.option_value, '"') = ''
      )
  ) THEN
    RAISE EXCEPTION
      'private PDP snapshot must be STABLE SECURITY DEFINER with blank search_path';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS proc
    WHERE proc.oid = (
      'public.get_storefront_pdp_core_v2(uuid,text,uuid)'
    )::pg_catalog.regprocedure
      AND proc.prosecdef
      AND proc.provolatile = 's'
      AND EXISTS (
        SELECT 1
        FROM pg_catalog.pg_options_to_table(
          COALESCE(proc.proconfig, ARRAY[]::text[])
        ) AS config
        WHERE config.option_name = 'search_path'
          AND pg_catalog.btrim(config.option_value, '"') = ''
      )
  ) THEN
    RAISE EXCEPTION
      'public PDP snapshot must be STABLE SECURITY DEFINER with blank search_path';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS proc
    WHERE proc.oid = (
      'public.resolve_storefront_public_snapshot_v2(text)'
    )::pg_catalog.regprocedure
      AND proc.prosecdef
      AND proc.provolatile = 's'
      AND EXISTS (
        SELECT 1
        FROM pg_catalog.pg_options_to_table(
          COALESCE(proc.proconfig, ARRAY[]::text[])
        ) AS config
        WHERE config.option_name = 'search_path'
          AND pg_catalog.btrim(config.option_value, '"') = ''
      )
  ) THEN
    RAISE EXCEPTION
      'public merchant snapshot must be STABLE SECURITY DEFINER with blank search_path';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS proc
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(proc.proacl, pg_catalog.acldefault('f', proc.proowner))
    ) AS acl
    WHERE proc.oid IN (
      'public.resolve_storefront_public_snapshot_v2(text)'::pg_catalog.regprocedure,
      'public.get_storefront_pdp_core_v2(uuid,text,uuid)'::pg_catalog.regprocedure,
      'public.get_storefront_pdp_semantic_enrichment_v1(uuid,uuid,text,jsonb,text,boolean,integer,integer,integer)'::pg_catalog.regprocedure
    )
      AND acl.grantee = 0
      AND acl.privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'PUBLIC unexpectedly has EXECUTE on storefront snapshot RPCs';
  END IF;

  IF NOT pg_catalog.has_function_privilege(
    'anon',
    'public.resolve_storefront_public_snapshot_v2(text)',
    'EXECUTE'
  )
    OR NOT pg_catalog.has_function_privilege(
      'anon',
      'public.get_storefront_pdp_core_v2(uuid,text,uuid)',
      'EXECUTE'
    )
    OR NOT pg_catalog.has_function_privilege(
      'anon',
      'public.get_storefront_pdp_semantic_enrichment_v1(uuid,uuid,text,jsonb,text,boolean,integer,integer,integer)',
      'EXECUTE'
    )
  THEN
    RAISE EXCEPTION 'anon lacks EXECUTE on storefront snapshot RPCs';
  END IF;

  IF pg_catalog.has_function_privilege(
    'anon',
    'private.get_storefront_pdp_core_v2(uuid,text,uuid)',
    'EXECUTE'
  )
    OR pg_catalog.has_function_privilege(
    'authenticated',
    'private.get_storefront_pdp_core_v2(uuid,text,uuid)',
    'EXECUTE'
  )
    OR pg_catalog.has_function_privilege(
      'anon',
      'private.get_storefront_pdp_semantic_enrichment_v1(uuid,uuid,text,jsonb,text,boolean,integer,integer,integer)',
      'EXECUTE'
    )
    OR pg_catalog.has_function_privilege(
      'authenticated',
      'private.get_storefront_pdp_semantic_enrichment_v1(uuid,uuid,text,jsonb,text,boolean,integer,integer,integer)',
      'EXECUTE'
    )
  THEN
    RAISE EXCEPTION 'public roles unexpectedly execute the private PDP snapshot';
  END IF;

  IF pg_catalog.has_function_privilege(
    'anon',
    'public.resolve_storefront_cached_merchant(text)',
    'EXECUTE'
  )
    OR pg_catalog.has_function_privilege(
      'authenticated',
      'public.resolve_storefront_cached_merchant(text)',
      'EXECUTE'
    )
    OR NOT pg_catalog.has_function_privilege(
      'service_role',
      'public.resolve_storefront_cached_merchant(text)',
      'EXECUTE'
    )
  THEN
    RAISE EXCEPTION
      'broad merchant resolver must remain executable only by service_role';
  END IF;
END;
$setup$;
