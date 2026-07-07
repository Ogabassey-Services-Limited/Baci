-- Reduce storefront cold-request database fanout for custom domains and harden
-- public RPC wrapper search paths used by product/serialized variant hydration.
--
-- The cached merchant resolver intentionally returns only the same storefront
-- public merchant projection used by apps/web/src/lib/cached-data.ts, plus the
-- already-public feature-settings allowlist. It is server-called with the
-- service-role Supabase client, so execute is granted only to service_role.

-- Domain lookup uses the existing idx_domains_active_lower_domain functional
-- partial index introduced in 20260620211259_resolve_storefront_auth_merchant.sql.

CREATE OR REPLACE FUNCTION public.resolve_storefront_cached_merchant(
  p_identifier text
)
RETURNS TABLE (
  merchant_data jsonb,
  custom_domain text,
  feature_settings jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_identifier text := lower(trim(p_identifier));
  v_active_domain_match_count bigint := 0;
BEGIN
  IF p_identifier IS NULL
    OR octet_length(p_identifier) > 254
    OR trim(p_identifier) = ''
  THEN
    RETURN;
  END IF;

  SELECT count(*)
  INTO v_active_domain_match_count
  FROM public.domains AS d
  WHERE lower(d.domain) = v_identifier
    AND d.status = 'active';

  IF v_active_domain_match_count > 1 THEN
    RAISE EXCEPTION 'ambiguous_active_storefront_domain'
      USING
        ERRCODE = 'P0001',
        DETAIL = format(
          'domain=%s active_match_count=%s',
          v_identifier,
          v_active_domain_match_count
        ),
        HINT = 'Resolve duplicate active domain rows before serving this storefront.';
  END IF;

  RETURN QUERY
  WITH normalized_input AS (
    SELECT v_identifier AS identifier
  ),
  slug_match AS (
    SELECT
      m.id,
      NULL::text AS matched_domain,
      0 AS match_rank
    FROM public.merchants AS m
    CROSS JOIN normalized_input AS input
    WHERE m.slug = input.identifier
    LIMIT 1
  ),
  matched_domain_candidates AS (
    SELECT
      d.domain,
      d.merchant_id,
      COALESCE(d.is_primary, false) AS is_primary,
      d.updated_at,
      d.created_at,
      d.id
    FROM public.domains AS d
    CROSS JOIN normalized_input AS input
    WHERE lower(d.domain) = input.identifier
      AND d.status = 'active'
  ),
  domain_match AS (
    SELECT
      candidate.merchant_id AS id,
      candidate.domain::text AS matched_domain,
      1 AS match_rank
    FROM matched_domain_candidates AS candidate
    ORDER BY
      candidate.is_primary DESC,
      candidate.updated_at DESC NULLS LAST,
      candidate.created_at DESC NULLS LAST,
      candidate.id
    LIMIT 1
  ),
  selected_merchant AS (
    SELECT candidate.id, candidate.matched_domain, candidate.match_rank
    FROM (
      SELECT * FROM slug_match
      UNION ALL
      SELECT * FROM domain_match
    ) AS candidate
    ORDER BY candidate.match_rank, candidate.id
    LIMIT 1
  )
  SELECT
    jsonb_build_object(
      'id', m.id,
      'business_name', m.business_name,
      'site_title', m.site_title,
      'site_tagline', m.site_tagline,
      'site_description', m.site_description,
      'business_type', m.business_type,
      'logo_url', m.logo_url,
      'phone', CASE WHEN COALESCE(m.is_published, false) THEN m.phone ELSE '' END,
      'email', CASE WHEN COALESCE(m.is_published, false) THEN m.email ELSE '' END,
      'support_email', CASE WHEN COALESCE(m.is_published, false) THEN m.support_email ELSE '' END,
      'support_phone', CASE WHEN COALESCE(m.is_published, false) THEN m.support_phone ELSE '' END,
      'social_media', m.social_media,
      'brand_colors', m.brand_colors,
      'slug', m.slug,
      'business_address', CASE WHEN COALESCE(m.is_published, false) THEN m.business_address ELSE '' END,
      'legal_entity_name', CASE WHEN COALESCE(m.is_published, false) THEN m.legal_entity_name ELSE NULL END,
      'registered_address', CASE WHEN COALESCE(m.is_published, false) THEN m.registered_address ELSE NULL END,
      'tax_identification_number', CASE WHEN COALESCE(m.is_published, false) THEN m.tax_identification_number ELSE NULL END,
      'trust_profile', CASE WHEN COALESCE(m.is_published, false) THEN m.trust_profile ELSE NULL END,
      'payout_currency', m.payout_currency,
      'paystack_subaccount_code', m.paystack_subaccount_code,
      'is_published', COALESCE(m.is_published, false),
      'template_id', m.template_id,
      'plan_expires_at', m.plan_expires_at,
      'plan_tier', m.plan_tier,
      'premium_features', m.premium_features,
      'country', m.country,
      'hero_slides', m.hero_slides,
      'mobile_hero_slides', m.mobile_hero_slides,
      'favicon_svg_url', m.favicon_svg_url,
      'favicon_png_32_url', m.favicon_png_32_url,
      'favicon_apple_touch_url', m.favicon_apple_touch_url,
      'vat_registration_status', m.vat_registration_status,
      'vat_rate', m.vat_rate,
      'published_config', m.published_config,
      'pages', m.pages,
      'about_page', m.about_page,
      'faq_items', m.faq_items,
      'updated_at', m.updated_at
    ) AS merchant_data,
    COALESCE(sm.matched_domain, primary_domain.domain)::text AS custom_domain,
    CASE
      WHEN fs.merchant_id IS NULL THEN NULL::jsonb
      ELSE jsonb_build_object(
        'about_page_enabled', fs.about_page_enabled,
        'agentic_checkout_enabled', fs.agentic_checkout_enabled,
        'auto_blog_enabled', fs.auto_blog_enabled,
        'blog_enabled', fs.blog_enabled,
        'blog_discover_image_validation_enabled', fs.blog_discover_image_validation_enabled,
        'checkout_collect_phone', fs.checkout_collect_phone,
        'checkout_require_account', fs.checkout_require_account,
        'checkout_show_order_notes', fs.checkout_show_order_notes,
        'contact_page_enabled', fs.contact_page_enabled,
        'credpal_enabled', fs.credpal_enabled,
        'credit_direct_enabled', fs.credit_direct_enabled,
        'credit_direct_max_amount', fs.credit_direct_max_amount,
        'credit_direct_min_amount', fs.credit_direct_min_amount,
        'custom_settings', fs.custom_settings,
        'discount_codes_enabled', fs.discount_codes_enabled,
        'faq_page_enabled', fs.faq_page_enabled,
        'facebook_pixel_id', fs.facebook_pixel_id,
        'free_shipping_threshold', fs.free_shipping_threshold,
        'google_analytics_id', fs.google_analytics_id,
        'google_place_id', fs.google_place_id,
        'google_reviews_enabled', fs.google_reviews_enabled,
        'guest_checkout_enabled', fs.guest_checkout_enabled,
        'juicyway_enabled', fs.juicyway_enabled,
        'klump_enabled', fs.klump_enabled,
        'klump_max_amount', fs.klump_max_amount,
        'klump_min_amount', fs.klump_min_amount,
        'korapay_enabled', fs.korapay_enabled,
        'loyalty_enabled', fs.loyalty_enabled,
        'low_stock_threshold', fs.low_stock_threshold,
        'order_tracking_enabled', fs.order_tracking_enabled,
        'pay_on_delivery_enabled', fs.pay_on_delivery_enabled,
        'paystack_enabled', fs.paystack_enabled,
        'preferred_international_gateway', fs.preferred_international_gateway,
        'preferred_local_gateway', fs.preferred_local_gateway,
        'privacy_page_enabled', fs.privacy_page_enabled,
        'reviews_enabled', fs.reviews_enabled,
        'rewards_page_enabled', fs.rewards_page_enabled,
        'shipping_insurance_enabled', fs.shipping_insurance_enabled,
        'shipping_insurance_min_order_value', fs.shipping_insurance_min_order_value,
        'shipping_insurance_opt_in_default', fs.shipping_insurance_opt_in_default,
        'shipping_providers', fs.shipping_providers,
        'show_recent_purchases', fs.show_recent_purchases,
        'show_stock_levels', fs.show_stock_levels,
        'snapchat_pixel_id', fs.snapchat_pixel_id,
        'terms_page_enabled', fs.terms_page_enabled,
        'tiktok_pixel_id', fs.tiktok_pixel_id,
        'twitter_pixel_id', fs.twitter_pixel_id,
        'vtu_airtime_enabled', fs.vtu_airtime_enabled,
        'vtu_checkout_addon_amounts', fs.vtu_checkout_addon_amounts,
        'vtu_checkout_addon_enabled', fs.vtu_checkout_addon_enabled,
        'vtu_data_enabled', fs.vtu_data_enabled,
        'vtu_electricity_enabled', fs.vtu_electricity_enabled,
        'vtu_enabled', fs.vtu_enabled,
        'vtu_loyalty_reward_enabled', fs.vtu_loyalty_reward_enabled,
        'vtu_tv_enabled', fs.vtu_tv_enabled,
        'wallet_order_auto_debit_enabled', fs.wallet_order_auto_debit_enabled,
        'wallet_paystack_dva_enabled', fs.wallet_paystack_dva_enabled,
        'customer_device_savings_enabled', fs.customer_device_savings_enabled,
        'customer_device_savings_auto_debit_enabled', fs.customer_device_savings_auto_debit_enabled,
        'customer_device_savings_break_fee_enabled', fs.customer_device_savings_break_fee_enabled,
        'wishlist_enabled', fs.wishlist_enabled
      )
    END AS feature_settings
  FROM selected_merchant AS sm
  JOIN public.merchants AS m ON m.id = sm.id
  LEFT JOIN LATERAL (
    SELECT d.domain
    FROM public.domains AS d
    WHERE d.merchant_id = m.id
      AND d.is_primary = true
      AND d.status = 'active'
    ORDER BY d.updated_at DESC NULLS LAST, d.created_at DESC NULLS LAST, d.id
    LIMIT 1
  ) AS primary_domain ON true
  LEFT JOIN public.merchant_feature_settings AS fs ON fs.merchant_id = m.id;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_storefront_cached_merchant(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_storefront_cached_merchant(text) TO service_role;

COMMENT ON FUNCTION public.resolve_storefront_cached_merchant(text) IS
  'Single-round-trip server-side storefront merchant resolver for cached domain/slug shell data; returns the public merchant projection plus public feature settings.';

ALTER FUNCTION public.get_storefront_product_variants(uuid[]) SET search_path TO '';
ALTER FUNCTION public.get_public_serialized_variant_availability_counts(uuid, uuid[], uuid) SET search_path TO '';
