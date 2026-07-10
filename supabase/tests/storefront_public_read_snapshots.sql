-- ================================================================
-- REGRESSION TEST: bounded public merchant/PDP read snapshots
--
-- USAGE:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f supabase/tests/storefront_public_read_snapshots.sql
-- ================================================================

BEGIN;

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);

DO $setup$
DECLARE
  v_merchant_id uuid := '4d19ab10-0000-4000-8000-000000000001';
  v_category_id uuid := '4d19ab10-0000-4000-8000-000000000002';
  v_simple_product_id uuid := '4d19ab10-0000-4000-8000-000000000003';
  v_simple_anchor_id uuid := '4d19ab10-0000-4000-8000-000000000004';
  v_variant_product_id uuid := '4d19ab10-0000-4000-8000-000000000005';
  v_variant_id uuid := '4d19ab10-0000-4000-8000-000000000006';
  v_legacy_product_id uuid := '4d19ab10-0000-4000-8000-000000000007';
  v_child_product_id uuid := '4d19ab10-0000-4000-8000-000000000008';
  v_child_category_id uuid := '4d19ab10-0000-4000-8000-000000000009';
  v_cluster_post_id uuid := '4d19ab10-0000-4000-8000-000000000010';
  v_linked_post_id uuid := '4d19ab10-0000-4000-8000-000000000011';
  v_unpublished_merchant_id uuid := '4d19ab10-0000-4000-8000-000000000012';
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

  INSERT INTO public.merchants (
    id,
    email,
    business_name,
    slug,
    is_published
  ) VALUES (
    v_merchant_id,
    'storefront-snapshot-test@example.com',
    'Storefront Snapshot Test',
    'storefront-snapshot-test',
    true
  );

  INSERT INTO public.merchant_feature_settings (
    merchant_id,
    blog_enabled,
    custom_settings
  )
  VALUES (
    v_merchant_id,
    true,
    '{"google_merchant_id":"public-merchant-id","draft_secret":"must-not-cross-public-rpc"}'::jsonb
  )
  ON CONFLICT (merchant_id) DO UPDATE
  SET
    blog_enabled = EXCLUDED.blog_enabled,
    custom_settings = EXCLUDED.custom_settings;

  INSERT INTO public.merchants (
    id,
    email,
    business_name,
    slug,
    is_published,
    paystack_subaccount_code,
    plan_tier,
    premium_features,
    published_config,
    pages
  ) VALUES (
    v_unpublished_merchant_id,
    'storefront-unpublished-snapshot-test@example.com',
    'Unpublished Snapshot Test',
    'storefront-unpublished-snapshot-test',
    false,
    'ACCT_PRIVATE_DRAFT',
    'business',
    '["private-feature"]'::jsonb,
    '{"draft":"private"}'::jsonb,
    '{"about":"private draft page"}'::jsonb
  );

  INSERT INTO public.merchant_feature_settings (
    merchant_id,
    blog_enabled,
    custom_settings
  ) VALUES (
    v_unpublished_merchant_id,
    true,
    '{"draft_secret":"must-not-cross-public-rpc"}'::jsonb
  )
  ON CONFLICT (merchant_id) DO UPDATE
  SET
    blog_enabled = EXCLUDED.blog_enabled,
    custom_settings = EXCLUDED.custom_settings;

  INSERT INTO public.domains (
    merchant_id,
    domain,
    domain_type,
    status,
    is_primary
  ) VALUES (
    v_merchant_id,
    '  SNAPSHOT-TEST.USEBACI.COM  ',
    'subdomain',
    'active',
    true
  );

  INSERT INTO public.domains (
    merchant_id,
    domain,
    domain_type,
    status,
    is_primary
  ) VALUES (
    v_unpublished_merchant_id,
    'unpublished-snapshot-test.usebaci.com',
    'subdomain',
    'active',
    true
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.domains AS domain_row
    WHERE domain_row.merchant_id = v_merchant_id
      AND domain_row.domain = 'snapshot-test.usebaci.com'
  ) THEN
    RAISE EXCEPTION 'domain write trigger did not normalize the hostname';
  END IF;

  BEGIN
    INSERT INTO public.domains (
      merchant_id,
      domain,
      domain_type,
      status,
      is_primary
    ) VALUES (
      v_merchant_id,
      'snapshot-test.usebaci.com',
      'subdomain',
      'active',
      false
    );

    RAISE EXCEPTION 'duplicate normalized active domain unexpectedly inserted';
  EXCEPTION
    WHEN unique_violation THEN NULL;
  END;

  INSERT INTO public.categories (
    id,
    merchant_id,
    name,
    slug,
    parent_id,
    is_active
  ) VALUES
    (
      v_category_id,
      v_merchant_id,
      'Snapshot Phones',
      'snapshot-phones',
      NULL,
      true
    ),
    (
      v_child_category_id,
      v_merchant_id,
      'Snapshot Android Phones',
      'snapshot-android-phones',
      v_category_id,
      true
    );

  INSERT INTO public.products (
    id,
    merchant_id,
    category_id,
    name,
    slug,
    price,
    status,
    has_variants,
    manage_stock,
    stock,
    stock_quantity,
    inventory_tracking_policy,
    images
  ) VALUES
    (
      v_simple_product_id,
      v_merchant_id,
      v_category_id,
      'Serialized Snapshot Phone',
      'serialized-snapshot-phone',
      100000,
      'active',
      false,
      true,
      99,
      99,
      'serialized_strict',
      '["https://example.com/simple.jpg"]'::jsonb
    ),
    (
      v_variant_product_id,
      v_merchant_id,
      v_category_id,
      'Variant Snapshot Phone',
      'variant-snapshot-phone',
      200000,
      'active',
      true,
      true,
      99,
      99,
      'serialized_strict',
      '["https://example.com/variant.jpg"]'::jsonb
    ),
    (
      v_child_product_id,
      v_merchant_id,
      v_child_category_id,
      'Child Category Snapshot Phone',
      'child-category-snapshot-phone',
      150000,
      'active',
      false,
      false,
      5,
      5,
      'off',
      '["https://example.com/child.jpg"]'::jsonb
    );

  INSERT INTO public.products (
    id,
    merchant_id,
    category_id,
    parent_product_id,
    name,
    slug,
    price,
    status,
    has_variants,
    manage_stock,
    stock,
    stock_quantity,
    inventory_tracking_policy,
    images
  ) VALUES (
    v_legacy_product_id,
    v_merchant_id,
    v_category_id,
    v_variant_product_id,
    'Legacy Variant Snapshot Phone',
    'legacy-variant-snapshot-phone',
    200000,
    'archived',
    false,
    false,
    0,
    0,
    'off',
    '[]'::jsonb
  );

  INSERT INTO public.product_variants (
    id,
    merchant_id,
    product_id,
    sku,
    attributes,
    stock_quantity,
    is_inventory_anchor,
    inventory_tracking_policy
  ) VALUES
    (
      v_simple_anchor_id,
      v_merchant_id,
      v_simple_product_id,
      'SNAPSHOT-SIMPLE-ANCHOR',
      '{}'::jsonb,
      99,
      true,
      'inherit'
    ),
    (
      v_variant_id,
      v_merchant_id,
      v_variant_product_id,
      'SNAPSHOT-VARIANT-128-BLACK',
      '{"storage":"128GB","color":"Black"}'::jsonb,
      99,
      false,
      'inherit'
    );

  INSERT INTO public.variant_inventory (
    merchant_id,
    variant_id,
    identifier_type,
    identifier_value,
    status
  ) VALUES
    (
      v_merchant_id,
      v_simple_anchor_id,
      'imei',
      '352313505010646',
      'available'
    ),
    (
      v_merchant_id,
      v_variant_id,
      'imei',
      '490154203237518',
      'available'
    );

  INSERT INTO public.product_key_specs (
    product_id,
    chipset,
    ram_gb,
    storage_gb
  ) VALUES
    (v_simple_product_id, 'Snapshot One', 8, 128),
    (v_child_product_id, 'Snapshot Two', 12, 256);

  INSERT INTO public.blog_posts (
    id,
    merchant_id,
    title,
    slug,
    content,
    excerpt,
    category,
    tags,
    keywords,
    author_name,
    status,
    published_at,
    reading_time_minutes
  ) VALUES
    (
      v_cluster_post_id,
      v_merchant_id,
      'Snapshot Phones Buying Guide',
      'snapshot-phones-buying-guide',
      'Compare snapshot phone battery and performance.',
      'Choose the right snapshot phone.',
      'Snapshot Phones',
      ARRAY['snapshot phones'],
      ARRAY['phone', 'battery'],
      'Snapshot Author',
      'published',
      pg_catalog.now() - INTERVAL '1 day',
      5
    ),
    (
      v_linked_post_id,
      v_merchant_id,
      'Serialized Snapshot Phone Guide',
      'serialized-snapshot-phone-guide',
      'A linked guide for the serialized snapshot phone.',
      'Read the linked product guide.',
      'Snapshot Phones',
      ARRAY['snapshot phones'],
      ARRAY['serialized phone'],
      'Snapshot Author',
      'published',
      pg_catalog.now(),
      4
    );

  INSERT INTO public.blog_post_products (
    merchant_id,
    blog_post_id,
    product_id
  ) VALUES (
    v_merchant_id,
    v_linked_post_id,
    v_simple_product_id
  );
END;
$setup$;

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.role', 'anon', true);

DO $assertions$
DECLARE
  v_merchant record;
  v_unpublished_merchant record;
  v_simple record;
  v_variant record;
  v_redirect record;
  v_missing record;
  v_enrichment record;
  v_missing_enrichment record;
BEGIN
  SELECT
    snapshot.resolution_status,
    snapshot.merchant_data,
    snapshot.custom_domain,
    snapshot.feature_settings
  INTO v_merchant
  FROM public.resolve_storefront_public_snapshot_v2(
    'SNAPSHOT-TEST.USEBACI.COM'
  ) AS snapshot;

  IF v_merchant.resolution_status IS DISTINCT FROM 'found'
    OR v_merchant.merchant_data->>'id' IS DISTINCT FROM
      '4d19ab10-0000-4000-8000-000000000001'
    OR (v_merchant.feature_settings->>'blog_enabled')::boolean IS DISTINCT FROM true
    OR v_merchant.feature_settings->'custom_settings'->>'google_merchant_id'
      IS DISTINCT FROM 'public-merchant-id'
    OR v_merchant.feature_settings->'custom_settings' ? 'draft_secret'
  THEN
    RAISE EXCEPTION 'public merchant snapshot did not resolve normalized domain';
  END IF;

  SELECT
    snapshot.resolution_status,
    snapshot.merchant_data,
    snapshot.custom_domain,
    snapshot.feature_settings
  INTO v_unpublished_merchant
  FROM public.resolve_storefront_public_snapshot_v2(
    'storefront-unpublished-snapshot-test'
  ) AS snapshot;

  IF v_unpublished_merchant.resolution_status IS DISTINCT FROM 'found'
    OR v_unpublished_merchant.merchant_data->>'id' IS DISTINCT FROM
      '4d19ab10-0000-4000-8000-000000000012'
    OR v_unpublished_merchant.merchant_data->>'business_name' IS DISTINCT FROM
      'Unpublished Snapshot Test'
    OR v_unpublished_merchant.merchant_data->>'slug' IS DISTINCT FROM
      'storefront-unpublished-snapshot-test'
    OR (v_unpublished_merchant.merchant_data->>'is_published')::boolean
      IS DISTINCT FROM false
    OR v_unpublished_merchant.merchant_data IS DISTINCT FROM
      pg_catalog.jsonb_build_object(
        'id', '4d19ab10-0000-4000-8000-000000000012',
        'business_name', 'Unpublished Snapshot Test',
        'slug', 'storefront-unpublished-snapshot-test',
        'is_published', false
      )
    OR v_unpublished_merchant.merchant_data ? 'paystack_subaccount_code'
    OR v_unpublished_merchant.merchant_data ? 'plan_tier'
    OR v_unpublished_merchant.merchant_data ? 'premium_features'
    OR v_unpublished_merchant.merchant_data ? 'published_config'
    OR v_unpublished_merchant.merchant_data ? 'pages'
    OR v_unpublished_merchant.custom_domain IS NOT NULL
    OR v_unpublished_merchant.feature_settings IS NOT NULL
  THEN
    RAISE EXCEPTION
      'unpublished merchant snapshot exposed draft, payment, plan, or feature data';
  END IF;

  SELECT snapshot.resolution_status, snapshot.product_data
  INTO v_simple
  FROM public.get_storefront_pdp_core_v2(
    '4d19ab10-0000-4000-8000-000000000001',
    'serialized-snapshot-phone',
    NULL
  ) AS snapshot;

  IF v_simple.resolution_status IS DISTINCT FROM 'found'
    OR (v_simple.product_data->>'stock_quantity')::integer IS DISTINCT FROM 1
    OR (v_simple.product_data->>'manage_stock')::boolean IS DISTINCT FROM true
    OR v_simple.product_data->'categories'->>'slug' IS DISTINCT FROM
      'snapshot-phones'
  THEN
    RAISE EXCEPTION 'simple PDP snapshot did not apply serialized availability';
  END IF;

  SELECT snapshot.resolution_status, snapshot.product_data
  INTO v_variant
  FROM public.get_storefront_pdp_core_v2(
    '4d19ab10-0000-4000-8000-000000000001',
    'variant-snapshot-phone',
    NULL
  ) AS snapshot;

  IF v_variant.resolution_status IS DISTINCT FROM 'found'
    OR pg_catalog.jsonb_array_length(
      v_variant.product_data->'product_variants'
    ) IS DISTINCT FROM 1
    OR (
      v_variant.product_data->'product_variants'->0->>'stock_quantity'
    )::integer IS DISTINCT FROM 1
  THEN
    RAISE EXCEPTION 'variant PDP snapshot did not apply serialized availability';
  END IF;

  SELECT snapshot.resolution_status, snapshot.product_data
  INTO v_redirect
  FROM public.get_storefront_pdp_core_v2(
    '4d19ab10-0000-4000-8000-000000000001',
    'legacy-variant-snapshot-phone',
    NULL
  ) AS snapshot;

  IF v_redirect.resolution_status IS DISTINCT FROM 'redirect'
    OR v_redirect.product_data->>'id' IS DISTINCT FROM
      '4d19ab10-0000-4000-8000-000000000005'
    OR v_redirect.product_data->>'slug' IS DISTINCT FROM
      'variant-snapshot-phone'
    OR v_redirect.product_data->'categories'->>'slug' IS DISTINCT FROM
      'snapshot-phones'
  THEN
    RAISE EXCEPTION 'legacy PDP snapshot did not return canonical redirect';
  END IF;

  SELECT snapshot.resolution_status, snapshot.product_data
  INTO v_missing
  FROM public.get_storefront_pdp_core_v2(
    '4d19ab10-0000-4000-8000-000000000001',
    'missing-snapshot-product',
    NULL
  ) AS snapshot;

  IF v_missing.resolution_status IS DISTINCT FROM 'not_found'
    OR v_missing.product_data IS NOT NULL
  THEN
    RAISE EXCEPTION 'missing PDP snapshot did not return explicit not_found';
  END IF;

  SELECT
    enrichment.resolution_status,
    enrichment.inventory_data,
    enrichment.cluster_guide_data,
    enrichment.product_guide_data
  INTO v_enrichment
  FROM public.get_storefront_pdp_semantic_enrichment_v1(
    '4d19ab10-0000-4000-8000-000000000001',
    '4d19ab10-0000-4000-8000-000000000003',
    'snapshot-phones',
    '[{"rule_order":0,"category_slug":"snapshot-phones","category_names":["snapshot phones"],"article_tokens":["phone","battery"]}]'::jsonb,
    '"snapshot phones" OR "phone" OR "battery"',
    true,
    48,
    48,
    8
  ) AS enrichment;

  IF v_enrichment.resolution_status IS DISTINCT FROM 'found'
    OR NOT v_enrichment.inventory_data @> '[{"slug":"serialized-snapshot-phone"}]'::jsonb
    OR NOT v_enrichment.inventory_data @> '[{"slug":"child-category-snapshot-phone","categories":{"slug":"snapshot-android-phones"}}]'::jsonb
    OR NOT v_enrichment.cluster_guide_data @> '[{"slug":"snapshot-phones-buying-guide"}]'::jsonb
    OR v_enrichment.product_guide_data->0->>'slug' IS DISTINCT FROM
      'serialized-snapshot-phone-guide'
  THEN
    RAISE EXCEPTION
      'PDP semantic enrichment did not preserve current product, canonical child category, and bounded guides';
  END IF;

  SELECT
    enrichment.resolution_status,
    enrichment.inventory_data,
    enrichment.cluster_guide_data,
    enrichment.product_guide_data
  INTO v_missing_enrichment
  FROM public.get_storefront_pdp_semantic_enrichment_v1(
    '4d19ab10-0000-4000-8000-000000000001',
    '4d19ab10-0000-4000-8000-000000000099',
    'snapshot-phones',
    '[]'::jsonb,
    '',
    true,
    48,
    48,
    8
  ) AS enrichment;

  IF v_missing_enrichment.resolution_status IS DISTINCT FROM 'not_found'
    OR v_missing_enrichment.inventory_data IS NOT NULL
    OR v_missing_enrichment.cluster_guide_data IS NOT NULL
    OR v_missing_enrichment.product_guide_data IS NOT NULL
  THEN
    RAISE EXCEPTION
      'missing PDP semantic enrichment did not return explicit not_found';
  END IF;
END;
$assertions$;

ROLLBACK;
