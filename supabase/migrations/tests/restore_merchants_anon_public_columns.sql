-- REGRESSION TEST: exact anon merchant grants and bounded public snapshot.
-- The nine Option-B bridge columns remain temporary until the documented
-- 2026-08-24 removal gate. Broader anon RPC grants and authenticated's current
-- table-wide read/policy are deferred S1 audit debt and are not repaired here.

BEGIN ISOLATION LEVEL REPEATABLE READ;

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);

DO $event_pipeline_contracts$
DECLARE
  actual text[];
  names constant text[] := ARRAY[
    'claim_event_deliveries_v1','cleanup_domain_event_pipeline_v1','dead_letter_ingress_event_v1',
    'enqueue_domain_event_v1','finish_event_delivery_v1','get_domain_event_queue_metrics_v1',
    'get_event_pipeline_operations_v1','is_event_ingress_capability_v1','list_event_pipeline_deliveries_v1',
    'list_event_pipeline_ingress_failures_v1','read_domain_events_v1','record_analytics_domain_event_v1',
    'record_event_worker_heartbeat_v1','record_platform_domain_event_v1','replay_event_deliveries_batch_v1',
    'replay_event_delivery_v1','replay_ingress_dead_letter_v1','route_domain_event_v1',
    'select_event_pipeline_replay_ids_v1'
  ];
BEGIN
  SELECT array_agg(
    proc.proname || '(' || pg_get_function_identity_arguments(proc.oid) || ')'
    ORDER BY proc.proname
  ) INTO actual
  FROM pg_proc AS proc
  JOIN pg_namespace AS namespace ON namespace.oid = proc.pronamespace
  WHERE namespace.nspname = 'public' AND proc.proname = ANY(names);
  IF actual IS DISTINCT FROM ARRAY[
    'claim_event_deliveries_v1(p_batch_size integer, p_worker_id text, p_lease_seconds integer)',
    'cleanup_domain_event_pipeline_v1(p_delivered_attempt_retention interval, p_queue_archive_retention interval)',
    'dead_letter_ingress_event_v1(p_queue_message_id bigint, p_domain_event_id uuid, p_original_envelope jsonb, p_failure_code text, p_failure_message text, p_parser_version integer)',
    'enqueue_domain_event_v1(p_producer text, p_trust_level text, p_idempotency_key text, p_external_event_id text, p_event_name text, p_subject_type text, p_subject_id text, p_merchant_id uuid, p_source jsonb, p_data jsonb, p_metadata jsonb, p_occurred_at timestamp with time zone, p_changed_fields text[], p_correlation_id text, p_causation_id uuid)',
    'finish_event_delivery_v1(p_delivery_id uuid, p_claim_token uuid, p_outcome text, p_available_at timestamp with time zone, p_error_code text, p_error_message text, p_http_status integer, p_provider_response_id text)',
    'get_domain_event_queue_metrics_v1()','get_event_pipeline_operations_v1()',
    'is_event_ingress_capability_v1(p_kind text, p_merchant_id uuid, p_event_type text, p_event_name text, p_event_id text, p_event_timestamp timestamp with time zone, p_producer text, p_source text, p_trust_level text)',
    'list_event_pipeline_deliveries_v1(p_status text, p_limit integer, p_offset integer, p_destination text, p_error_code text, p_merchant_id uuid, p_from timestamp with time zone, p_to timestamp with time zone)',
    'list_event_pipeline_ingress_failures_v1(p_limit integer, p_offset integer, p_error_code text, p_merchant_id uuid, p_from timestamp with time zone, p_to timestamp with time zone)',
    'read_domain_events_v1(p_visibility_timeout_seconds integer, p_batch_size integer, p_max_poll_seconds integer)',
    'record_analytics_domain_event_v1(p_merchant_id uuid, p_event_type text, p_event_name text, p_event_data jsonb, p_domain_event_data jsonb, p_delivery_data jsonb, p_external_event_id text, p_source text, p_producer text, p_trust_level text, p_event_timestamp timestamp with time zone, p_metadata jsonb)',
    'record_event_worker_heartbeat_v1(p_worker_name text, p_worker_id text, p_status text, p_processed_count integer, p_error_code text)',
    'record_platform_domain_event_v1(p_event_type text, p_event_name text, p_event_data jsonb, p_delivery_data jsonb, p_external_event_id text, p_merchant_id uuid, p_session_id text, p_page_url text, p_referrer text, p_producer text, p_trust_level text, p_event_timestamp timestamp with time zone, p_metadata jsonb)',
    'replay_event_deliveries_batch_v1(p_delivery_ids uuid[], p_replayed_by uuid, p_replay_reason text)',
    'replay_event_delivery_v1(p_delivery_id uuid, p_replayed_by uuid, p_replay_reason text)',
    'replay_ingress_dead_letter_v1(p_failure_id uuid, p_replayed_by uuid, p_replay_reason text)',
    'route_domain_event_v1(p_queue_message_id bigint, p_domain_event_id uuid, p_destinations text[], p_shadow boolean, p_active_destinations text[])',
    'select_event_pipeline_replay_ids_v1(p_status text, p_destination text, p_error_code text, p_merchant_id uuid, p_from timestamp with time zone, p_to timestamp with time zone)'
  ]::text[] THEN
    RAISE EXCEPTION 'event pipeline function identity drift: %', actual;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc AS proc JOIN pg_namespace AS namespace ON namespace.oid = proc.pronamespace
    WHERE namespace.nspname = 'public' AND proc.proname = ANY(names)
      AND NOT (COALESCE(proc.proconfig, ARRAY[]::text[]) && ARRAY['search_path=','search_path=""'])
  ) THEN RAISE EXCEPTION 'event pipeline function search_path drift'; END IF;
END
$event_pipeline_contracts$;

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.role', 'anon', true);

DO $grant_assertions$
DECLARE
  actual_public_cols text[];
  actual_anon_select_policies text[];
  expected_public_cols text[] := ARRAY[
    'about_page','bank_account_name','bank_account_number','bank_code',
    'bank_name','brand_colors','business_address','business_name',
    'business_type','cac_rc_number','country','created_at',
    'email','email_domain','email_domain_verified','email_logo_url',
    'email_sender_name','endpoint_id','endpoint_scheme_id','facebook_pixel_id',
    'faq_items','favicon_apple_touch_url','favicon_png_192_url','favicon_png_32_url',
    'favicon_svg_url','favicon_uploaded_at','feature_settings','firs_business_id',
    'firs_service_id','gmc_variants_enabled','google_analytics_id','hero_image_ids',
    'hero_images_generated_at','hero_images_regeneration_count','hero_slides','id',
    'is_published','kyc_status','legal_entity_name','lga_code',
    'logo_url','mobile_hero_slides','multi_currency_enabled','offline_conversions_enabled',
    'order_prefix','pages','payout_currency','phone',
    'plan_expires_at','plan_started_at','plan_tier','premium_features',
    'published_at','published_config','registered_address','rider_phone_number',
    'self_fulfillment_enabled','signup_source','site_description','site_tagline',
    'site_title','slug','snapchat_pixel_id','social_media',
    'state_code','support_email','support_phone','tax_exempt',
    'tax_identification_number','template_id','tiktok_pixel_id','trust_profile',
    'twitter_pixel_id','updated_at','user_id','vat_rate',
    'vat_registration_status'
  ];
  secret_cols constant text[] := ARRAY[
    'bvn','nin','cac_number','firs_public_key','firs_certificate','firs_email',
    'firs_password_encrypted','facebook_capi_token','facebook_capi_access_token',
    'tiktok_access_token','snapchat_capi_token','ga4_api_secret','stripe_customer_id',
    'stripe_subscription_id','paystack_subaccount_code','virtual_terminal_code',
    'is_platform_admin','google_product_sheet_url'
  ];
BEGIN
  SELECT array_agg(attribute.attname ORDER BY attribute.attname)
  INTO actual_public_cols
  FROM pg_attribute AS attribute
  WHERE attribute.attrelid = 'public.merchants'::regclass
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped
    AND has_column_privilege(
      'anon', 'public.merchants', attribute.attname, 'SELECT'
    );

  IF actual_public_cols IS DISTINCT FROM expected_public_cols THEN
    RAISE EXCEPTION 'anon merchant SELECT projection mismatch: expected %, got %',
      expected_public_cols, actual_public_cols;
  END IF;
  IF cardinality(expected_public_cols) <> 77 THEN
    RAISE EXCEPTION 'anon merchant expected projection must contain 77 columns';
  END IF;
  IF expected_public_cols && secret_cols THEN
    RAISE EXCEPTION 'anon merchant projection contains a named secret';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.table_privileges
    WHERE table_schema = 'public' AND table_name = 'merchants'
      AND grantee IN ('anon', 'PUBLIC')
  ) OR EXISTS (
    SELECT 1 FROM information_schema.column_privileges
    WHERE table_schema = 'public' AND table_name = 'merchants'
      AND grantee IN ('anon', 'PUBLIC') AND privilege_type <> 'SELECT'
  ) THEN
    RAISE EXCEPTION 'anon/PUBLIC retained table-wide or write merchant privileges';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(secret_cols) AS secret(column_name)
    WHERE has_column_privilege('anon', 'public.merchants', secret.column_name, 'SELECT')
  ) THEN
    RAISE EXCEPTION 'anon can SELECT a named secret/private merchant column';
  END IF;

  SELECT array_agg(
    policy.policyname || '|' || policy.permissive || '|' ||
      pg_get_expr(catalog.polqual, catalog.polrelid)
    ORDER BY policy.policyname
  )
  INTO actual_anon_select_policies
  FROM pg_policies AS policy
  JOIN pg_policy AS catalog
    ON catalog.polrelid = 'public.merchants'::regclass
    AND catalog.polname = policy.policyname
  WHERE policy.schemaname = 'public'
    AND policy.tablename = 'merchants'
    AND policy.cmd IN ('SELECT', 'ALL')
    AND policy.roles && ARRAY['anon', 'public']::name[];

  IF actual_anon_select_policies IS DISTINCT FROM ARRAY[
    'Anon can view merchants|PERMISSIVE|(is_published IS TRUE)'
  ]::text[] THEN
    RAISE EXCEPTION 'effective anon merchant SELECT policy mismatch: %',
      actual_anon_select_policies;
  END IF;
END
$grant_assertions$;

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);

DO $setup$
BEGIN
  INSERT INTO public.merchants (id, email, business_name, slug, is_published)
  VALUES
    ('7a7a7a7a-0000-4000-8000-000000000001', 'boundary-published@example.com',
      'Boundary Published', 'task5-boundary-published', true),
    ('7a7a7a7a-0000-4000-8000-000000000002', 'boundary-unpublished@example.com',
      'Boundary Unpublished', 'task5-boundary-unpublished', false);

  INSERT INTO public.merchant_feature_settings (
    merchant_id, blog_enabled, custom_settings
  ) VALUES (
    '7a7a7a7a-0000-4000-8000-000000000001', true,
    '{"google_merchant_id":"public-id","google_store_widget_enabled":true,"secret":"denied"}'::jsonb
  )
  ON CONFLICT (merchant_id) DO UPDATE SET
    blog_enabled = EXCLUDED.blog_enabled,
    custom_settings = EXCLUDED.custom_settings;
END
$setup$;

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.role', 'anon', true);

DO $snapshot_assertions$
DECLARE
  published record;
  unpublished record;
  missing record;
  expected_published_merchant_keys text[] := ARRAY[
    'about_page','brand_colors','business_address','business_name',
    'business_type','country','email','faq_items',
    'favicon_apple_touch_url','favicon_png_32_url','favicon_svg_url','hero_slides',
    'id','is_published','legal_entity_name','logo_url',
    'mobile_hero_slides','pages','payout_currency','paystack_subaccount_configured',
    'phone','price_negotiation_enabled','published_config','registered_address',
    'site_description','site_tagline','site_title','slug',
    'social_media','support_email','support_phone','tax_identification_number',
    'template_id','trust_profile','updated_at','vat_rate',
    'vat_registration_status'
  ];
  expected_unpublished_merchant_keys text[] := ARRAY[
    'business_name','id','is_published','slug'
  ];
  expected_feature_setting_keys text[] := ARRAY[
    'about_page_enabled','agentic_checkout_enabled','auto_blog_enabled','blog_discover_image_validation_enabled',
    'blog_enabled','checkout_collect_phone','checkout_require_account','checkout_show_order_notes',
    'contact_page_enabled','credit_direct_enabled','credit_direct_max_amount','credit_direct_min_amount',
    'credpal_enabled','custom_settings','customer_device_savings_auto_debit_enabled','customer_device_savings_break_fee_enabled',
    'customer_device_savings_enabled','discount_codes_enabled','facebook_pixel_id','faq_page_enabled',
    'free_shipping_threshold','google_analytics_id','google_place_id','google_reviews_enabled',
    'guest_checkout_enabled','juicyway_enabled','klump_enabled','klump_max_amount',
    'klump_min_amount','korapay_enabled','low_stock_threshold','loyalty_enabled',
    'order_tracking_enabled','pay_on_delivery_enabled','paystack_enabled','preferred_international_gateway',
    'preferred_local_gateway','privacy_page_enabled','repairs_catalog_enabled','reviews_enabled',
    'rewards_page_enabled','shipping_insurance_enabled','shipping_insurance_min_order_value','shipping_insurance_opt_in_default',
    'shipping_providers','show_recent_purchases','show_stock_levels','snapchat_pixel_id',
    'terms_page_enabled','tiktok_pixel_id','twitter_pixel_id','vtu_airtime_enabled',
    'vtu_checkout_addon_amounts','vtu_checkout_addon_enabled','vtu_data_enabled','vtu_electricity_enabled',
    'vtu_enabled','vtu_loyalty_reward_enabled','vtu_tv_enabled','wallet_order_auto_debit_enabled',
    'wallet_paystack_dva_enabled','wishlist_enabled'
  ];
  function_definition text;
  published_visibility_count bigint;
  unpublished_visibility_count bigint;
BEGIN
  IF cardinality(expected_feature_setting_keys) <> 62 THEN
    RAISE EXCEPTION 'public snapshot feature manifest must contain 62 keys';
  END IF;
  SELECT count(*) INTO published_visibility_count
  FROM public.merchants
  WHERE id = '7a7a7a7a-0000-4000-8000-000000000001';
  SELECT count(*) INTO unpublished_visibility_count
  FROM public.merchants
  WHERE id = '7a7a7a7a-0000-4000-8000-000000000002';
  IF published_visibility_count IS DISTINCT FROM 1
    OR unpublished_visibility_count IS DISTINCT FROM 0
  THEN
    RAISE EXCEPTION 'effective anon merchant RLS is not published-only: published %, unpublished %',
      published_visibility_count, unpublished_visibility_count;
  END IF;

  SELECT pg_get_functiondef('public.resolve_storefront_public_snapshot_v2(text)'::regprocedure)
  INTO function_definition;
  IF function_definition !~ 'SECURITY DEFINER'
    OR function_definition !~ 'SET search_path TO '''''
  THEN
    RAISE EXCEPTION 'public snapshot function identity/config drifted';
  END IF;

  SELECT * INTO published
  FROM public.resolve_storefront_public_snapshot_v2('task5-boundary-published');
  SELECT * INTO unpublished
  FROM public.resolve_storefront_public_snapshot_v2('task5-boundary-unpublished');
  SELECT * INTO missing
  FROM public.resolve_storefront_public_snapshot_v2('task5-boundary-missing');

  IF published.resolution_status IS DISTINCT FROM 'found'
    OR ARRAY(SELECT jsonb_object_keys(published.merchant_data) ORDER BY 1)
      IS DISTINCT FROM expected_published_merchant_keys
    OR ARRAY(SELECT jsonb_object_keys(published.feature_settings) ORDER BY 1)
      IS DISTINCT FROM expected_feature_setting_keys
    OR ARRAY(SELECT jsonb_object_keys(published.feature_settings->'custom_settings') ORDER BY 1)
      IS DISTINCT FROM ARRAY['google_merchant_id','google_store_widget_enabled']::text[]
  THEN
    RAISE EXCEPTION 'published public snapshot key manifest drifted';
  END IF;
  IF unpublished.resolution_status IS DISTINCT FROM 'found'
    OR ARRAY(SELECT jsonb_object_keys(unpublished.merchant_data) ORDER BY 1)
      IS DISTINCT FROM expected_unpublished_merchant_keys
    OR unpublished.feature_settings IS NOT NULL
    OR unpublished.custom_domain IS NOT NULL
  THEN
    RAISE EXCEPTION 'unpublished public snapshot minimization drifted';
  END IF;
  IF missing.resolution_status IS DISTINCT FROM 'not_found'
    OR missing.merchant_data IS NOT NULL
    OR missing.feature_settings IS NOT NULL
    OR missing.custom_domain IS NOT NULL
  THEN
    RAISE EXCEPTION 'missing public snapshot must return a null payload';
  END IF;
END
$snapshot_assertions$;

ROLLBACK;
