-- Canonical audit coverage for merchant feature, checkout, and payment-gateway
-- settings. Credentials and nested configuration are represented only by safe
-- presence transitions; no raw provider, analytics, or custom-settings data is
-- written to the immutable audit ledger.

CREATE OR REPLACE FUNCTION private.audit_merchant_feature_settings_presence_state_v1(
  p_old_present boolean,
  p_new_present boolean
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object(
    'present', COALESCE(p_new_present, false),
    'state', CASE
      WHEN NOT COALESCE(p_old_present, false)
        AND COALESCE(p_new_present, false) THEN 'configured'
      WHEN COALESCE(p_old_present, false)
        AND NOT COALESCE(p_new_present, false) THEN 'cleared'
      WHEN COALESCE(p_old_present, false)
        AND COALESCE(p_new_present, false) THEN 'rotated'
      ELSE 'unchanged'
    END
  );
$$;

ALTER FUNCTION private.audit_merchant_feature_settings_presence_state_v1(
  boolean,
  boolean
) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.audit_merchant_feature_settings_presence_state_v1(
  boolean,
  boolean
) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.audit_merchant_feature_settings_bounded_number_v1(
  p_value numeric,
  p_minimum numeric,
  p_maximum numeric
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_value IS NULL THEN 'null'::jsonb
    WHEN p_value BETWEEN p_minimum AND p_maximum THEN pg_catalog.to_jsonb(p_value)
    ELSE '"out_of_bounds"'::jsonb
  END;
$$;

ALTER FUNCTION private.audit_merchant_feature_settings_bounded_number_v1(
  numeric,
  numeric,
  numeric
) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.audit_merchant_feature_settings_bounded_number_v1(
  numeric,
  numeric,
  numeric
) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.audit_merchant_feature_settings_gateway_v1(
  p_value text
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_value IS NULL THEN 'null'::jsonb
    WHEN p_value IN ('paystack', 'korapay') THEN pg_catalog.to_jsonb(p_value)
    ELSE '"unrecognized"'::jsonb
  END;
$$;

ALTER FUNCTION private.audit_merchant_feature_settings_gateway_v1(text)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION private.audit_merchant_feature_settings_gateway_v1(text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.audit_merchant_feature_settings_addon_amounts_v1(
  p_amounts integer[]
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  IF p_amounts IS NULL THEN
    RETURN 'null'::jsonb;
  END IF;
  IF pg_catalog.cardinality(p_amounts) > 20 OR EXISTS (
    SELECT 1
    FROM pg_catalog.unnest(p_amounts) AS amount(value)
    WHERE amount.value IS NULL OR amount.value < 0 OR amount.value > 1000000
  ) THEN
    RETURN '"out_of_bounds"'::jsonb;
  END IF;
  RETURN pg_catalog.to_jsonb(p_amounts);
END;
$$;

ALTER FUNCTION private.audit_merchant_feature_settings_addon_amounts_v1(integer[])
  OWNER TO postgres;
REVOKE ALL ON FUNCTION private.audit_merchant_feature_settings_addon_amounts_v1(integer[])
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.audit_merchant_feature_settings_custom_settings_state_v1(
  p_old jsonb,
  p_new jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_old jsonb := COALESCE(p_old, '{}'::jsonb);
  v_new jsonb := COALESCE(p_new, '{}'::jsonb);
  v_old_present boolean;
  v_new_present boolean;
  v_changed_safe_keys text[];
BEGIN
  v_old_present := v_old NOT IN ('{}'::jsonb, '[]'::jsonb, 'null'::jsonb);
  v_new_present := v_new NOT IN ('{}'::jsonb, '[]'::jsonb, 'null'::jsonb);
  v_changed_safe_keys := ARRAY_REMOVE(ARRAY[
    CASE WHEN v_new_present
      AND (v_old -> 'agentic_agent_allowlist') IS DISTINCT FROM (v_new -> 'agentic_agent_allowlist')
      THEN 'agentic_agent_allowlist' END,
    CASE WHEN v_new_present
      AND (v_old -> 'agentic_agent_denylist') IS DISTINCT FROM (v_new -> 'agentic_agent_denylist')
      THEN 'agentic_agent_denylist' END,
    CASE WHEN v_new_present
      AND (v_old -> 'google_merchant_id') IS DISTINCT FROM (v_new -> 'google_merchant_id')
      THEN 'google_merchant_id' END,
    CASE WHEN v_new_present
      AND (v_old -> 'google_store_widget_enabled') IS DISTINCT FROM (v_new -> 'google_store_widget_enabled')
      THEN 'google_store_widget_enabled' END,
    CASE WHEN v_new_present
      AND (v_old -> 'integrationCardsCollapsed') IS DISTINCT FROM (v_new -> 'integrationCardsCollapsed')
      THEN 'integrationCardsCollapsed' END,
    CASE WHEN v_new_present
      AND (v_old -> 'migration_imports') IS DISTINCT FROM (v_new -> 'migration_imports')
      THEN 'migration_imports' END,
    CASE WHEN v_new_present
      AND (v_old -> 'paypal_enabled') IS DISTINCT FROM (v_new -> 'paypal_enabled')
      THEN 'paypal_enabled' END,
    CASE WHEN v_new_present
      AND (v_old -> 'paypal_mode') IS DISTINCT FROM (v_new -> 'paypal_mode')
      THEN 'paypal_mode' END
  ]::text[], NULL);

  RETURN private.audit_merchant_feature_settings_presence_state_v1(
    v_old_present,
    v_new_present
  ) || pg_catalog.jsonb_build_object(
    'changed_safe_keys', pg_catalog.to_jsonb(
      COALESCE(v_changed_safe_keys, ARRAY[]::text[])
    )
  );
END;
$$;

ALTER FUNCTION private.audit_merchant_feature_settings_custom_settings_state_v1(
  jsonb,
  jsonb
) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.audit_merchant_feature_settings_custom_settings_state_v1(
  jsonb,
  jsonb
) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.audit_merchant_feature_settings_change_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  -- Exact fields retain bounded safe values; presence fields redact values;
  -- ignored lifecycle fields emit nothing; identity fields are forbidden.
  v_exact_fields text[] := ARRAY[
    'about_page_enabled', 'agentic_checkout_enabled', 'auto_blog_enabled',
    'auto_generate_schema', 'blog_discover_image_validation_enabled',
    'blog_enabled', 'checkout_collect_phone', 'checkout_require_account',
    'checkout_show_order_notes', 'contact_page_enabled', 'credit_direct_enabled',
    'credit_direct_max_amount', 'credit_direct_min_amount', 'credpal_enabled',
    'customer_device_savings_auto_debit_enabled',
    'customer_device_savings_break_fee_enabled',
    'customer_device_savings_enabled', 'discount_codes_enabled',
    'email_notifications_enabled', 'faq_page_enabled', 'free_shipping_threshold',
    'google_reviews_enabled', 'guest_checkout_enabled', 'juicyway_enabled',
    'klump_enabled', 'klump_max_amount', 'klump_min_amount', 'korapay_enabled',
    'low_stock_threshold', 'loyalty_enabled', 'order_tracking_enabled',
    'pay_on_delivery_enabled', 'paystack_enabled',
    'preferred_international_gateway', 'preferred_local_gateway',
    'privacy_page_enabled', 'repairs_catalog_enabled', 'reviews_enabled',
    'rewards_page_enabled', 'shipping_insurance_enabled',
    'shipping_insurance_min_order_value', 'shipping_insurance_opt_in_default',
    'shipping_markup_percentage', 'show_recent_purchases', 'show_stock_levels',
    'sms_notifications_enabled', 'terms_page_enabled', 'vtu_airtime_enabled',
    'vtu_betting_enabled', 'vtu_checkout_addon_amounts',
    'vtu_checkout_addon_enabled', 'vtu_customer_cashback_enabled',
    'vtu_customer_cashback_rate', 'vtu_data_enabled', 'vtu_electricity_enabled',
    'vtu_enabled', 'vtu_loyalty_reward_enabled', 'vtu_merchant_commission_rate',
    'vtu_tv_enabled', 'wallet_order_auto_debit_enabled',
    'wallet_paystack_dva_enabled', 'wishlist_enabled'
  ]::text[];
  v_presence_fields text[] := ARRAY[
    'credit_direct_public_key', 'custom_settings', 'facebook_capi_token',
    'facebook_pixel_id', 'ga4_api_secret', 'google_analytics_id',
    'google_place_id', 'repair_settings', 'shipping_providers',
    'snapchat_capi_token', 'snapchat_pixel_id', 'tiktok_access_token',
    'tiktok_pixel_id', 'twitter_pixel_id'
  ]::text[];
  v_ignored_fields text[] := ARRAY[
    'created_at', 'custom_robots_txt', 'updated_at'
  ]::text[];
  v_forbidden_fields text[] := ARRAY['id', 'merchant_id']::text[];
  v_classified_fields text[];
  v_old_exact_values jsonb := '{}'::jsonb;
  v_new_exact_values jsonb := '{}'::jsonb;
  v_old_presence_values jsonb := '{}'::jsonb;
  v_new_presence_values jsonb := '{}'::jsonb;
  v_new_snapshot_credentials jsonb := '{}'::jsonb;
  v_before_values jsonb := '{}'::jsonb;
  v_after_values jsonb := '{}'::jsonb;
  v_changed_fields text[] := ARRAY[]::text[];
  v_exact_changed_fields text[] := ARRAY[]::text[];
  v_presence_changed_fields text[] := ARRAY[]::text[];
  v_field text;
  v_old_present boolean;
  v_new_present boolean;
  v_missing_classified_field boolean := false;
  v_unclassified_live_field boolean := false;
  v_merchant_id uuid;
  v_settings_id uuid;
  v_merchant_label text;
  v_action text;
  v_writer_capability uuid;
BEGIN
  -- This is intentionally closed-world. A new source column cannot be
  -- silently omitted from audit coverage, even if it is updated on its own.
  v_classified_fields := v_exact_fields || v_presence_fields ||
    v_ignored_fields || v_forbidden_fields;
  IF pg_catalog.cardinality(v_classified_fields) <> (
    SELECT pg_catalog.count(DISTINCT classified_field.name)
    FROM pg_catalog.unnest(v_classified_fields) AS classified_field(name)
  ) THEN
    RAISE EXCEPTION 'audit_merchant_feature_settings_classification_invalid'
      USING ERRCODE = '55000';
  END IF;

  WITH live_columns AS (
    SELECT attribute.attname AS name
    FROM pg_catalog.pg_attribute AS attribute
    WHERE attribute.attrelid = 'public.merchant_feature_settings'::pg_catalog.regclass
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
  ), classification_comparison AS (
    SELECT classified_field.name AS classified_name, live_column.name AS live_name
    FROM pg_catalog.unnest(v_classified_fields) AS classified_field(name)
    FULL OUTER JOIN live_columns AS live_column
      ON live_column.name = classified_field.name
  )
  SELECT
    COALESCE(
      pg_catalog.bool_or(
        classified_name IS NOT NULL AND live_name IS NULL
      ),
      false
    ),
    COALESCE(
      pg_catalog.bool_or(
        classified_name IS NULL AND live_name IS NOT NULL
      ),
      false
    )
  INTO v_missing_classified_field, v_unclassified_live_field
  FROM classification_comparison;

  IF v_missing_classified_field THEN
    RAISE EXCEPTION 'audit_merchant_feature_settings_classification_invalid'
      USING ERRCODE = '55000';
  END IF;
  IF v_unclassified_live_field THEN
    RAISE EXCEPTION 'audit_merchant_feature_settings_unclassified_column'
      USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.id IS DISTINCT FROM NEW.id THEN
    RAISE EXCEPTION 'audit_merchant_feature_settings_id_reassignment_forbidden'
      USING ERRCODE = '22023';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.merchant_id IS DISTINCT FROM NEW.merchant_id THEN
    RAISE EXCEPTION 'audit_merchant_feature_settings_merchant_reassignment_forbidden'
      USING ERRCODE = '22023';
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_merchant_id := OLD.merchant_id;
    v_settings_id := OLD.id;
    v_action := 'merchant.feature_settings.delete';
  ELSIF TG_OP = 'INSERT' THEN
    v_merchant_id := NEW.merchant_id;
    v_settings_id := NEW.id;
    v_action := 'merchant.feature_settings.create';
  ELSE
    v_merchant_id := NEW.merchant_id;
    v_settings_id := NEW.id;
    v_action := 'merchant.feature_settings.update';
  END IF;
  IF v_merchant_id IS NULL OR v_settings_id IS NULL THEN
    RAISE EXCEPTION 'audit_merchant_feature_settings_identity_required'
      USING ERRCODE = '22023';
  END IF;
  SELECT NULLIF(pg_catalog.btrim(merchant.business_name), '')
    INTO v_merchant_label
  FROM public.merchants AS merchant
  WHERE merchant.id = v_merchant_id;
  IF v_merchant_label IS NOT NULL
    AND pg_catalog.char_length(v_merchant_label) > 160 THEN
    v_merchant_label := NULL;
  END IF;

  IF TG_OP <> 'INSERT' THEN
    v_old_exact_values := pg_catalog.jsonb_build_object(
      'about_page_enabled', OLD.about_page_enabled,
      'agentic_checkout_enabled', OLD.agentic_checkout_enabled,
      'auto_blog_enabled', OLD.auto_blog_enabled,
      'auto_generate_schema', OLD.auto_generate_schema,
      'blog_discover_image_validation_enabled', OLD.blog_discover_image_validation_enabled,
      'blog_enabled', OLD.blog_enabled,
      'checkout_collect_phone', OLD.checkout_collect_phone,
      'checkout_require_account', OLD.checkout_require_account,
      'checkout_show_order_notes', OLD.checkout_show_order_notes,
      'contact_page_enabled', OLD.contact_page_enabled,
      'credit_direct_enabled', OLD.credit_direct_enabled,
      'credit_direct_max_amount', private.audit_merchant_feature_settings_bounded_number_v1(OLD.credit_direct_max_amount, 0, 100000000),
      'credit_direct_min_amount', private.audit_merchant_feature_settings_bounded_number_v1(OLD.credit_direct_min_amount, 0, 100000000),
      'credpal_enabled', OLD.credpal_enabled,
      'customer_device_savings_auto_debit_enabled', OLD.customer_device_savings_auto_debit_enabled,
      'customer_device_savings_break_fee_enabled', OLD.customer_device_savings_break_fee_enabled,
      'customer_device_savings_enabled', OLD.customer_device_savings_enabled,
      'discount_codes_enabled', OLD.discount_codes_enabled,
      'email_notifications_enabled', OLD.email_notifications_enabled,
      'faq_page_enabled', OLD.faq_page_enabled,
      'free_shipping_threshold', private.audit_merchant_feature_settings_bounded_number_v1(OLD.free_shipping_threshold, -9999999999.99, 9999999999.99),
      'google_reviews_enabled', OLD.google_reviews_enabled,
      'guest_checkout_enabled', OLD.guest_checkout_enabled,
      'juicyway_enabled', OLD.juicyway_enabled,
      'klump_enabled', OLD.klump_enabled,
      'klump_max_amount', private.audit_merchant_feature_settings_bounded_number_v1(OLD.klump_max_amount, 0, 100000000),
      'klump_min_amount', private.audit_merchant_feature_settings_bounded_number_v1(OLD.klump_min_amount, 0, 100000000),
      'korapay_enabled', OLD.korapay_enabled,
      'low_stock_threshold', private.audit_merchant_feature_settings_bounded_number_v1(OLD.low_stock_threshold, -2147483648, 2147483647),
      'loyalty_enabled', OLD.loyalty_enabled,
      'order_tracking_enabled', OLD.order_tracking_enabled,
      'pay_on_delivery_enabled', OLD.pay_on_delivery_enabled,
      'paystack_enabled', OLD.paystack_enabled,
      'preferred_international_gateway', private.audit_merchant_feature_settings_gateway_v1(OLD.preferred_international_gateway),
      'preferred_local_gateway', private.audit_merchant_feature_settings_gateway_v1(OLD.preferred_local_gateway)
    ) || pg_catalog.jsonb_build_object(
      'privacy_page_enabled', OLD.privacy_page_enabled,
      'repairs_catalog_enabled', OLD.repairs_catalog_enabled,
      'reviews_enabled', OLD.reviews_enabled,
      'rewards_page_enabled', OLD.rewards_page_enabled,
      'shipping_insurance_enabled', OLD.shipping_insurance_enabled,
      'shipping_insurance_min_order_value', private.audit_merchant_feature_settings_bounded_number_v1(OLD.shipping_insurance_min_order_value, 0, 100000000),
      'shipping_insurance_opt_in_default', OLD.shipping_insurance_opt_in_default,
      'shipping_markup_percentage', private.audit_merchant_feature_settings_bounded_number_v1(OLD.shipping_markup_percentage, -100, 1000),
      'show_recent_purchases', OLD.show_recent_purchases,
      'show_stock_levels', OLD.show_stock_levels,
      'sms_notifications_enabled', OLD.sms_notifications_enabled,
      'terms_page_enabled', OLD.terms_page_enabled,
      'vtu_airtime_enabled', OLD.vtu_airtime_enabled,
      'vtu_betting_enabled', OLD.vtu_betting_enabled,
      'vtu_checkout_addon_amounts', private.audit_merchant_feature_settings_addon_amounts_v1(OLD.vtu_checkout_addon_amounts),
      'vtu_checkout_addon_enabled', OLD.vtu_checkout_addon_enabled,
      'vtu_customer_cashback_enabled', OLD.vtu_customer_cashback_enabled,
      'vtu_customer_cashback_rate', private.audit_merchant_feature_settings_bounded_number_v1(OLD.vtu_customer_cashback_rate, 0, 100),
      'vtu_data_enabled', OLD.vtu_data_enabled,
      'vtu_electricity_enabled', OLD.vtu_electricity_enabled,
      'vtu_enabled', OLD.vtu_enabled,
      'vtu_loyalty_reward_enabled', OLD.vtu_loyalty_reward_enabled,
      'vtu_merchant_commission_rate', private.audit_merchant_feature_settings_bounded_number_v1(OLD.vtu_merchant_commission_rate, 0, 100),
      'vtu_tv_enabled', OLD.vtu_tv_enabled,
      'wallet_order_auto_debit_enabled', OLD.wallet_order_auto_debit_enabled,
      'wallet_paystack_dva_enabled', OLD.wallet_paystack_dva_enabled,
      'wishlist_enabled', OLD.wishlist_enabled
    );
    v_old_presence_values := pg_catalog.jsonb_build_object(
      'credit_direct_public_key', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.credit_direct_public_key), '') IS NOT NULL),
      'custom_settings', pg_catalog.jsonb_build_object('present', OLD.custom_settings IS NOT NULL AND OLD.custom_settings NOT IN ('{}'::jsonb, '[]'::jsonb, 'null'::jsonb)),
      'facebook_capi_token', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.facebook_capi_token), '') IS NOT NULL),
      'facebook_pixel_id', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.facebook_pixel_id), '') IS NOT NULL),
      'ga4_api_secret', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.ga4_api_secret), '') IS NOT NULL),
      'google_analytics_id', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.google_analytics_id), '') IS NOT NULL),
      'google_place_id', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.google_place_id), '') IS NOT NULL),
      'repair_settings', pg_catalog.jsonb_build_object('present', OLD.repair_settings IS NOT NULL AND OLD.repair_settings NOT IN ('{}'::jsonb, '[]'::jsonb, 'null'::jsonb)),
      'shipping_providers', pg_catalog.jsonb_build_object('present', OLD.shipping_providers IS NOT NULL AND OLD.shipping_providers NOT IN ('{}'::jsonb, '[]'::jsonb, 'null'::jsonb)),
      'snapchat_capi_token', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.snapchat_capi_token), '') IS NOT NULL),
      'snapchat_pixel_id', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.snapchat_pixel_id), '') IS NOT NULL),
      'tiktok_access_token', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.tiktok_access_token), '') IS NOT NULL),
      'tiktok_pixel_id', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.tiktok_pixel_id), '') IS NOT NULL),
      'twitter_pixel_id', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.twitter_pixel_id), '') IS NOT NULL)
    );
  END IF;

  IF TG_OP <> 'DELETE' THEN
    v_new_exact_values := pg_catalog.jsonb_build_object(
      'about_page_enabled', NEW.about_page_enabled,
      'agentic_checkout_enabled', NEW.agentic_checkout_enabled,
      'auto_blog_enabled', NEW.auto_blog_enabled,
      'auto_generate_schema', NEW.auto_generate_schema,
      'blog_discover_image_validation_enabled', NEW.blog_discover_image_validation_enabled,
      'blog_enabled', NEW.blog_enabled,
      'checkout_collect_phone', NEW.checkout_collect_phone,
      'checkout_require_account', NEW.checkout_require_account,
      'checkout_show_order_notes', NEW.checkout_show_order_notes,
      'contact_page_enabled', NEW.contact_page_enabled,
      'credit_direct_enabled', NEW.credit_direct_enabled,
      'credit_direct_max_amount', private.audit_merchant_feature_settings_bounded_number_v1(NEW.credit_direct_max_amount, 0, 100000000),
      'credit_direct_min_amount', private.audit_merchant_feature_settings_bounded_number_v1(NEW.credit_direct_min_amount, 0, 100000000),
      'credpal_enabled', NEW.credpal_enabled,
      'customer_device_savings_auto_debit_enabled', NEW.customer_device_savings_auto_debit_enabled,
      'customer_device_savings_break_fee_enabled', NEW.customer_device_savings_break_fee_enabled,
      'customer_device_savings_enabled', NEW.customer_device_savings_enabled,
      'discount_codes_enabled', NEW.discount_codes_enabled,
      'email_notifications_enabled', NEW.email_notifications_enabled,
      'faq_page_enabled', NEW.faq_page_enabled,
      'free_shipping_threshold', private.audit_merchant_feature_settings_bounded_number_v1(NEW.free_shipping_threshold, -9999999999.99, 9999999999.99),
      'google_reviews_enabled', NEW.google_reviews_enabled,
      'guest_checkout_enabled', NEW.guest_checkout_enabled,
      'juicyway_enabled', NEW.juicyway_enabled,
      'klump_enabled', NEW.klump_enabled,
      'klump_max_amount', private.audit_merchant_feature_settings_bounded_number_v1(NEW.klump_max_amount, 0, 100000000),
      'klump_min_amount', private.audit_merchant_feature_settings_bounded_number_v1(NEW.klump_min_amount, 0, 100000000),
      'korapay_enabled', NEW.korapay_enabled,
      'low_stock_threshold', private.audit_merchant_feature_settings_bounded_number_v1(NEW.low_stock_threshold, -2147483648, 2147483647),
      'loyalty_enabled', NEW.loyalty_enabled,
      'order_tracking_enabled', NEW.order_tracking_enabled,
      'pay_on_delivery_enabled', NEW.pay_on_delivery_enabled,
      'paystack_enabled', NEW.paystack_enabled,
      'preferred_international_gateway', private.audit_merchant_feature_settings_gateway_v1(NEW.preferred_international_gateway),
      'preferred_local_gateway', private.audit_merchant_feature_settings_gateway_v1(NEW.preferred_local_gateway)
    ) || pg_catalog.jsonb_build_object(
      'privacy_page_enabled', NEW.privacy_page_enabled,
      'repairs_catalog_enabled', NEW.repairs_catalog_enabled,
      'reviews_enabled', NEW.reviews_enabled,
      'rewards_page_enabled', NEW.rewards_page_enabled,
      'shipping_insurance_enabled', NEW.shipping_insurance_enabled,
      'shipping_insurance_min_order_value', private.audit_merchant_feature_settings_bounded_number_v1(NEW.shipping_insurance_min_order_value, 0, 100000000),
      'shipping_insurance_opt_in_default', NEW.shipping_insurance_opt_in_default,
      'shipping_markup_percentage', private.audit_merchant_feature_settings_bounded_number_v1(NEW.shipping_markup_percentage, -100, 1000),
      'show_recent_purchases', NEW.show_recent_purchases,
      'show_stock_levels', NEW.show_stock_levels,
      'sms_notifications_enabled', NEW.sms_notifications_enabled,
      'terms_page_enabled', NEW.terms_page_enabled,
      'vtu_airtime_enabled', NEW.vtu_airtime_enabled,
      'vtu_betting_enabled', NEW.vtu_betting_enabled,
      'vtu_checkout_addon_amounts', private.audit_merchant_feature_settings_addon_amounts_v1(NEW.vtu_checkout_addon_amounts),
      'vtu_checkout_addon_enabled', NEW.vtu_checkout_addon_enabled,
      'vtu_customer_cashback_enabled', NEW.vtu_customer_cashback_enabled,
      'vtu_customer_cashback_rate', private.audit_merchant_feature_settings_bounded_number_v1(NEW.vtu_customer_cashback_rate, 0, 100),
      'vtu_data_enabled', NEW.vtu_data_enabled,
      'vtu_electricity_enabled', NEW.vtu_electricity_enabled,
      'vtu_enabled', NEW.vtu_enabled,
      'vtu_loyalty_reward_enabled', NEW.vtu_loyalty_reward_enabled,
      'vtu_merchant_commission_rate', private.audit_merchant_feature_settings_bounded_number_v1(NEW.vtu_merchant_commission_rate, 0, 100),
      'vtu_tv_enabled', NEW.vtu_tv_enabled,
      'wallet_order_auto_debit_enabled', NEW.wallet_order_auto_debit_enabled,
      'wallet_paystack_dva_enabled', NEW.wallet_paystack_dva_enabled,
      'wishlist_enabled', NEW.wishlist_enabled
    );
    v_new_presence_values := pg_catalog.jsonb_build_object(
      'credit_direct_public_key', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.credit_direct_public_key), '') IS NOT NULL),
      'custom_settings', pg_catalog.jsonb_build_object('present', NEW.custom_settings IS NOT NULL AND NEW.custom_settings NOT IN ('{}'::jsonb, '[]'::jsonb, 'null'::jsonb)),
      'facebook_capi_token', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.facebook_capi_token), '') IS NOT NULL),
      'facebook_pixel_id', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.facebook_pixel_id), '') IS NOT NULL),
      'ga4_api_secret', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.ga4_api_secret), '') IS NOT NULL),
      'google_analytics_id', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.google_analytics_id), '') IS NOT NULL),
      'google_place_id', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.google_place_id), '') IS NOT NULL),
      'repair_settings', pg_catalog.jsonb_build_object('present', NEW.repair_settings IS NOT NULL AND NEW.repair_settings NOT IN ('{}'::jsonb, '[]'::jsonb, 'null'::jsonb)),
      'shipping_providers', pg_catalog.jsonb_build_object('present', NEW.shipping_providers IS NOT NULL AND NEW.shipping_providers NOT IN ('{}'::jsonb, '[]'::jsonb, 'null'::jsonb)),
      'snapchat_capi_token', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.snapchat_capi_token), '') IS NOT NULL),
      'snapchat_pixel_id', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.snapchat_pixel_id), '') IS NOT NULL),
      'tiktok_access_token', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.tiktok_access_token), '') IS NOT NULL),
      'tiktok_pixel_id', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.tiktok_pixel_id), '') IS NOT NULL),
      'twitter_pixel_id', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.twitter_pixel_id), '') IS NOT NULL)
    );
    IF TG_OP = 'INSERT' THEN
      FOREACH v_field IN ARRAY v_presence_fields LOOP
        v_new_present := COALESCE(
          (v_new_presence_values -> v_field ->> 'present')::boolean,
          false
        );
        IF v_field = 'custom_settings' THEN
          v_new_snapshot_credentials := v_new_snapshot_credentials ||
            pg_catalog.jsonb_build_object(
              v_field,
              private.audit_merchant_feature_settings_custom_settings_state_v1(
                NULL,
                NEW.custom_settings
              )
            );
        ELSE
          v_new_snapshot_credentials := v_new_snapshot_credentials ||
            pg_catalog.jsonb_build_object(
              v_field,
              private.audit_merchant_feature_settings_presence_state_v1(
                false,
                v_new_present
              )
            );
        END IF;
      END LOOP;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_changed_fields := ARRAY['settings_snapshot']::text[];
    v_after_values := pg_catalog.jsonb_build_object(
      'settings', v_new_exact_values,
      'credentials', v_new_snapshot_credentials
    );
  ELSIF TG_OP = 'DELETE' THEN
    v_changed_fields := ARRAY['settings_snapshot']::text[];
    v_before_values := pg_catalog.jsonb_build_object(
      'settings', v_old_exact_values,
      'credentials', v_old_presence_values
    );
  ELSE
    v_exact_changed_fields := ARRAY_REMOVE(ARRAY[
      CASE WHEN OLD.about_page_enabled IS DISTINCT FROM NEW.about_page_enabled THEN 'about_page_enabled' END,
      CASE WHEN OLD.agentic_checkout_enabled IS DISTINCT FROM NEW.agentic_checkout_enabled THEN 'agentic_checkout_enabled' END,
      CASE WHEN OLD.auto_blog_enabled IS DISTINCT FROM NEW.auto_blog_enabled THEN 'auto_blog_enabled' END,
      CASE WHEN OLD.auto_generate_schema IS DISTINCT FROM NEW.auto_generate_schema THEN 'auto_generate_schema' END,
      CASE WHEN OLD.blog_discover_image_validation_enabled IS DISTINCT FROM NEW.blog_discover_image_validation_enabled THEN 'blog_discover_image_validation_enabled' END,
      CASE WHEN OLD.blog_enabled IS DISTINCT FROM NEW.blog_enabled THEN 'blog_enabled' END,
      CASE WHEN OLD.checkout_collect_phone IS DISTINCT FROM NEW.checkout_collect_phone THEN 'checkout_collect_phone' END,
      CASE WHEN OLD.checkout_require_account IS DISTINCT FROM NEW.checkout_require_account THEN 'checkout_require_account' END,
      CASE WHEN OLD.checkout_show_order_notes IS DISTINCT FROM NEW.checkout_show_order_notes THEN 'checkout_show_order_notes' END,
      CASE WHEN OLD.contact_page_enabled IS DISTINCT FROM NEW.contact_page_enabled THEN 'contact_page_enabled' END,
      CASE WHEN OLD.credit_direct_enabled IS DISTINCT FROM NEW.credit_direct_enabled THEN 'credit_direct_enabled' END,
      CASE WHEN OLD.credit_direct_max_amount IS DISTINCT FROM NEW.credit_direct_max_amount THEN 'credit_direct_max_amount' END,
      CASE WHEN OLD.credit_direct_min_amount IS DISTINCT FROM NEW.credit_direct_min_amount THEN 'credit_direct_min_amount' END,
      CASE WHEN OLD.credpal_enabled IS DISTINCT FROM NEW.credpal_enabled THEN 'credpal_enabled' END,
      CASE WHEN OLD.customer_device_savings_auto_debit_enabled IS DISTINCT FROM NEW.customer_device_savings_auto_debit_enabled THEN 'customer_device_savings_auto_debit_enabled' END,
      CASE WHEN OLD.customer_device_savings_break_fee_enabled IS DISTINCT FROM NEW.customer_device_savings_break_fee_enabled THEN 'customer_device_savings_break_fee_enabled' END,
      CASE WHEN OLD.customer_device_savings_enabled IS DISTINCT FROM NEW.customer_device_savings_enabled THEN 'customer_device_savings_enabled' END,
      CASE WHEN OLD.discount_codes_enabled IS DISTINCT FROM NEW.discount_codes_enabled THEN 'discount_codes_enabled' END,
      CASE WHEN OLD.email_notifications_enabled IS DISTINCT FROM NEW.email_notifications_enabled THEN 'email_notifications_enabled' END,
      CASE WHEN OLD.faq_page_enabled IS DISTINCT FROM NEW.faq_page_enabled THEN 'faq_page_enabled' END,
      CASE WHEN OLD.free_shipping_threshold IS DISTINCT FROM NEW.free_shipping_threshold THEN 'free_shipping_threshold' END,
      CASE WHEN OLD.google_reviews_enabled IS DISTINCT FROM NEW.google_reviews_enabled THEN 'google_reviews_enabled' END,
      CASE WHEN OLD.guest_checkout_enabled IS DISTINCT FROM NEW.guest_checkout_enabled THEN 'guest_checkout_enabled' END,
      CASE WHEN OLD.juicyway_enabled IS DISTINCT FROM NEW.juicyway_enabled THEN 'juicyway_enabled' END,
      CASE WHEN OLD.klump_enabled IS DISTINCT FROM NEW.klump_enabled THEN 'klump_enabled' END,
      CASE WHEN OLD.klump_max_amount IS DISTINCT FROM NEW.klump_max_amount THEN 'klump_max_amount' END,
      CASE WHEN OLD.klump_min_amount IS DISTINCT FROM NEW.klump_min_amount THEN 'klump_min_amount' END,
      CASE WHEN OLD.korapay_enabled IS DISTINCT FROM NEW.korapay_enabled THEN 'korapay_enabled' END,
      CASE WHEN OLD.low_stock_threshold IS DISTINCT FROM NEW.low_stock_threshold THEN 'low_stock_threshold' END,
      CASE WHEN OLD.loyalty_enabled IS DISTINCT FROM NEW.loyalty_enabled THEN 'loyalty_enabled' END,
      CASE WHEN OLD.order_tracking_enabled IS DISTINCT FROM NEW.order_tracking_enabled THEN 'order_tracking_enabled' END,
      CASE WHEN OLD.pay_on_delivery_enabled IS DISTINCT FROM NEW.pay_on_delivery_enabled THEN 'pay_on_delivery_enabled' END,
      CASE WHEN OLD.paystack_enabled IS DISTINCT FROM NEW.paystack_enabled THEN 'paystack_enabled' END,
      CASE WHEN OLD.preferred_international_gateway IS DISTINCT FROM NEW.preferred_international_gateway THEN 'preferred_international_gateway' END,
      CASE WHEN OLD.preferred_local_gateway IS DISTINCT FROM NEW.preferred_local_gateway THEN 'preferred_local_gateway' END,
      CASE WHEN OLD.privacy_page_enabled IS DISTINCT FROM NEW.privacy_page_enabled THEN 'privacy_page_enabled' END,
      CASE WHEN OLD.repairs_catalog_enabled IS DISTINCT FROM NEW.repairs_catalog_enabled THEN 'repairs_catalog_enabled' END,
      CASE WHEN OLD.reviews_enabled IS DISTINCT FROM NEW.reviews_enabled THEN 'reviews_enabled' END,
      CASE WHEN OLD.rewards_page_enabled IS DISTINCT FROM NEW.rewards_page_enabled THEN 'rewards_page_enabled' END,
      CASE WHEN OLD.shipping_insurance_enabled IS DISTINCT FROM NEW.shipping_insurance_enabled THEN 'shipping_insurance_enabled' END,
      CASE WHEN OLD.shipping_insurance_min_order_value IS DISTINCT FROM NEW.shipping_insurance_min_order_value THEN 'shipping_insurance_min_order_value' END,
      CASE WHEN OLD.shipping_insurance_opt_in_default IS DISTINCT FROM NEW.shipping_insurance_opt_in_default THEN 'shipping_insurance_opt_in_default' END,
      CASE WHEN OLD.shipping_markup_percentage IS DISTINCT FROM NEW.shipping_markup_percentage THEN 'shipping_markup_percentage' END,
      CASE WHEN OLD.show_recent_purchases IS DISTINCT FROM NEW.show_recent_purchases THEN 'show_recent_purchases' END,
      CASE WHEN OLD.show_stock_levels IS DISTINCT FROM NEW.show_stock_levels THEN 'show_stock_levels' END,
      CASE WHEN OLD.sms_notifications_enabled IS DISTINCT FROM NEW.sms_notifications_enabled THEN 'sms_notifications_enabled' END,
      CASE WHEN OLD.terms_page_enabled IS DISTINCT FROM NEW.terms_page_enabled THEN 'terms_page_enabled' END,
      CASE WHEN OLD.vtu_airtime_enabled IS DISTINCT FROM NEW.vtu_airtime_enabled THEN 'vtu_airtime_enabled' END,
      CASE WHEN OLD.vtu_betting_enabled IS DISTINCT FROM NEW.vtu_betting_enabled THEN 'vtu_betting_enabled' END,
      CASE WHEN OLD.vtu_checkout_addon_amounts IS DISTINCT FROM NEW.vtu_checkout_addon_amounts THEN 'vtu_checkout_addon_amounts' END,
      CASE WHEN OLD.vtu_checkout_addon_enabled IS DISTINCT FROM NEW.vtu_checkout_addon_enabled THEN 'vtu_checkout_addon_enabled' END,
      CASE WHEN OLD.vtu_customer_cashback_enabled IS DISTINCT FROM NEW.vtu_customer_cashback_enabled THEN 'vtu_customer_cashback_enabled' END,
      CASE WHEN OLD.vtu_customer_cashback_rate IS DISTINCT FROM NEW.vtu_customer_cashback_rate THEN 'vtu_customer_cashback_rate' END,
      CASE WHEN OLD.vtu_data_enabled IS DISTINCT FROM NEW.vtu_data_enabled THEN 'vtu_data_enabled' END,
      CASE WHEN OLD.vtu_electricity_enabled IS DISTINCT FROM NEW.vtu_electricity_enabled THEN 'vtu_electricity_enabled' END,
      CASE WHEN OLD.vtu_enabled IS DISTINCT FROM NEW.vtu_enabled THEN 'vtu_enabled' END,
      CASE WHEN OLD.vtu_loyalty_reward_enabled IS DISTINCT FROM NEW.vtu_loyalty_reward_enabled THEN 'vtu_loyalty_reward_enabled' END,
      CASE WHEN OLD.vtu_merchant_commission_rate IS DISTINCT FROM NEW.vtu_merchant_commission_rate THEN 'vtu_merchant_commission_rate' END,
      CASE WHEN OLD.vtu_tv_enabled IS DISTINCT FROM NEW.vtu_tv_enabled THEN 'vtu_tv_enabled' END,
      CASE WHEN OLD.wallet_order_auto_debit_enabled IS DISTINCT FROM NEW.wallet_order_auto_debit_enabled THEN 'wallet_order_auto_debit_enabled' END,
      CASE WHEN OLD.wallet_paystack_dva_enabled IS DISTINCT FROM NEW.wallet_paystack_dva_enabled THEN 'wallet_paystack_dva_enabled' END,
      CASE WHEN OLD.wishlist_enabled IS DISTINCT FROM NEW.wishlist_enabled THEN 'wishlist_enabled' END
    ]::text[], NULL);
    FOREACH v_field IN ARRAY v_exact_changed_fields LOOP
      v_changed_fields := pg_catalog.array_append(v_changed_fields, v_field);
      v_before_values := v_before_values || pg_catalog.jsonb_build_object(
        v_field,
        v_old_exact_values -> v_field
      );
      v_after_values := v_after_values || pg_catalog.jsonb_build_object(
        v_field,
        v_new_exact_values -> v_field
      );
    END LOOP;

    v_presence_changed_fields := ARRAY_REMOVE(ARRAY[
      CASE WHEN OLD.credit_direct_public_key IS DISTINCT FROM NEW.credit_direct_public_key THEN 'credit_direct_public_key' END,
      CASE WHEN OLD.custom_settings IS DISTINCT FROM NEW.custom_settings THEN 'custom_settings' END,
      CASE WHEN OLD.facebook_capi_token IS DISTINCT FROM NEW.facebook_capi_token THEN 'facebook_capi_token' END,
      CASE WHEN OLD.facebook_pixel_id IS DISTINCT FROM NEW.facebook_pixel_id THEN 'facebook_pixel_id' END,
      CASE WHEN OLD.ga4_api_secret IS DISTINCT FROM NEW.ga4_api_secret THEN 'ga4_api_secret' END,
      CASE WHEN OLD.google_analytics_id IS DISTINCT FROM NEW.google_analytics_id THEN 'google_analytics_id' END,
      CASE WHEN OLD.google_place_id IS DISTINCT FROM NEW.google_place_id THEN 'google_place_id' END,
      CASE WHEN OLD.repair_settings IS DISTINCT FROM NEW.repair_settings THEN 'repair_settings' END,
      CASE WHEN OLD.shipping_providers IS DISTINCT FROM NEW.shipping_providers THEN 'shipping_providers' END,
      CASE WHEN OLD.snapchat_capi_token IS DISTINCT FROM NEW.snapchat_capi_token THEN 'snapchat_capi_token' END,
      CASE WHEN OLD.snapchat_pixel_id IS DISTINCT FROM NEW.snapchat_pixel_id THEN 'snapchat_pixel_id' END,
      CASE WHEN OLD.tiktok_access_token IS DISTINCT FROM NEW.tiktok_access_token THEN 'tiktok_access_token' END,
      CASE WHEN OLD.tiktok_pixel_id IS DISTINCT FROM NEW.tiktok_pixel_id THEN 'tiktok_pixel_id' END,
      CASE WHEN OLD.twitter_pixel_id IS DISTINCT FROM NEW.twitter_pixel_id THEN 'twitter_pixel_id' END
    ]::text[], NULL);
    FOREACH v_field IN ARRAY v_presence_changed_fields LOOP
      v_old_present := COALESCE(
        (v_old_presence_values -> v_field ->> 'present')::boolean,
        false
      );
      v_new_present := COALESCE(
        (v_new_presence_values -> v_field ->> 'present')::boolean,
        false
      );
      IF NOT v_old_present AND NOT v_new_present THEN
        CONTINUE;
      END IF;
      v_changed_fields := pg_catalog.array_append(v_changed_fields, v_field);
      v_before_values := v_before_values || pg_catalog.jsonb_build_object(
        v_field,
        pg_catalog.jsonb_build_object('present', v_old_present)
      );
      IF v_field = 'custom_settings' THEN
        v_after_values := v_after_values || pg_catalog.jsonb_build_object(
          v_field,
          private.audit_merchant_feature_settings_custom_settings_state_v1(
            OLD.custom_settings,
            NEW.custom_settings
          )
        );
      ELSE
        v_after_values := v_after_values || pg_catalog.jsonb_build_object(
          v_field,
          private.audit_merchant_feature_settings_presence_state_v1(
            v_old_present,
            v_new_present
          )
        );
      END IF;
    END LOOP;
  END IF;

  IF pg_catalog.cardinality(v_changed_fields) = 0 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  -- The canonical writer permits at most 64 changed fields and top-level JSON
  -- keys. A bounded nested snapshot keeps wide PUT/upsert writes auditable
  -- without smuggling raw configuration into the record.
  IF TG_OP = 'UPDATE' AND pg_catalog.cardinality(v_changed_fields) > 60 THEN
    v_new_snapshot_credentials := '{}'::jsonb;
    FOREACH v_field IN ARRAY v_presence_fields LOOP
      v_old_present := COALESCE(
        (v_old_presence_values -> v_field ->> 'present')::boolean,
        false
      );
      v_new_present := COALESCE(
        (v_new_presence_values -> v_field ->> 'present')::boolean,
        false
      );
      IF v_field = 'custom_settings' THEN
        v_new_snapshot_credentials := v_new_snapshot_credentials ||
          pg_catalog.jsonb_build_object(
            v_field,
            CASE
              WHEN v_field = ANY(v_presence_changed_fields) THEN
                private.audit_merchant_feature_settings_custom_settings_state_v1(
                  OLD.custom_settings,
                  NEW.custom_settings
                )
              ELSE pg_catalog.jsonb_build_object('present', v_new_present)
            END
          );
      ELSE
        v_new_snapshot_credentials := v_new_snapshot_credentials ||
          pg_catalog.jsonb_build_object(
            v_field,
            CASE
              WHEN v_field = ANY(v_presence_changed_fields) THEN
                private.audit_merchant_feature_settings_presence_state_v1(
                  v_old_present,
                  v_new_present
                )
              ELSE pg_catalog.jsonb_build_object('present', v_new_present)
            END
          );
      END IF;
    END LOOP;
    v_changed_fields := ARRAY['settings_snapshot']::text[];
    v_before_values := pg_catalog.jsonb_build_object(
      'settings', v_old_exact_values,
      'credentials', v_old_presence_values
    );
    v_after_values := pg_catalog.jsonb_build_object(
      'settings', v_new_exact_values,
      'credentials', v_new_snapshot_credentials
    );
  END IF;
  IF pg_catalog.octet_length(v_before_values::text) > 16384
    OR pg_catalog.octet_length(v_after_values::text) > 16384 THEN
    RAISE EXCEPTION 'audit_merchant_feature_settings_payload_too_large'
      USING ERRCODE = '54000';
  END IF;

  SELECT capability.capability INTO v_writer_capability
  FROM private.audit_event_writer_capabilities AS capability
  WHERE capability.capability_name = 'canonical_audit_event_writer_v1';
  IF v_writer_capability IS NULL THEN
    RAISE EXCEPTION 'audit_merchant_feature_settings_writer_capability_unavailable'
      USING ERRCODE = '42501';
  END IF;
  PERFORM private.write_audit_event_v1(
    v_merchant_id, v_merchant_label, v_action, 'merchant_feature_settings'::text,
    v_settings_id::text, v_changed_fields,
    NULLIF(v_before_values, '{}'::jsonb), NULLIF(v_after_values, '{}'::jsonb),
    NULL::uuid, NULL::uuid, 1::smallint,
    pg_catalog.jsonb_build_object(
      'category', 'merchant_feature_settings',
      'operation', pg_catalog.lower(TG_OP)
    ), v_writer_capability
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

ALTER FUNCTION private.audit_merchant_feature_settings_change_v1()
  OWNER TO postgres;
REVOKE ALL ON FUNCTION private.audit_merchant_feature_settings_change_v1()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS audit_merchant_feature_settings_change_v1
  ON public.merchant_feature_settings;
CREATE TRIGGER audit_merchant_feature_settings_change_v1
  AFTER INSERT OR DELETE OR UPDATE ON public.merchant_feature_settings
  FOR EACH ROW
  EXECUTE FUNCTION private.audit_merchant_feature_settings_change_v1();
