-- Expose merchant entitlement fields to mobile-admin so DB-managed paid plans
-- and explicit feature grants can unlock gated mobile features without relying
-- solely on RevenueCat state.

CREATE OR REPLACE FUNCTION public.get_user_merchant_context()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_merchant_id uuid;
  v_user_id uuid := (SELECT auth.uid());
  v_is_owner boolean := false;
  v_merchant_data jsonb;
  v_domain_data jsonb;
BEGIN
  IF COALESCE((SELECT auth.role()), '') NOT IN ('authenticated', 'service_role')
    OR v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT m.id
    INTO v_merchant_id
  FROM public.merchants AS m
  WHERE m.user_id = v_user_id
    AND (m.business_name IS NOT NULL OR m.slug IS NOT NULL)
  ORDER BY m.id ASC
  LIMIT 1;

  IF v_merchant_id IS NOT NULL THEN
    v_is_owner := true;
  END IF;

  IF v_merchant_id IS NULL THEN
    SELECT sm.merchant_id
      INTO v_merchant_id
    FROM public.staff_members AS sm
    WHERE sm.user_id = v_user_id
      AND sm.status = 'active'
    ORDER BY sm.id ASC
    LIMIT 1;
  END IF;

  IF v_merchant_id IS NOT NULL THEN
    SELECT pg_catalog.to_jsonb(m)
      INTO v_merchant_data
    FROM (
      SELECT
        id,
        user_id,
        email,
        business_name,
        business_type,
        slug,
        logo_url,
        favicon_png_192_url,
        is_published,
        phone,
        plan_tier,
        plan_expires_at,
        premium_features,
        vat_registration_status,
        vat_rate,
        payout_currency,
        brand_colors,
        country,
        updated_at,
        CASE WHEN v_is_owner THEN bank_code ELSE NULL END AS bank_code,
        CASE WHEN v_is_owner THEN bank_account_number ELSE NULL END AS bank_account_number,
        CASE WHEN v_is_owner THEN bank_name ELSE NULL END AS bank_name,
        CASE WHEN v_is_owner THEN bank_account_name ELSE NULL END AS bank_account_name,
        CASE WHEN v_is_owner THEN paystack_subaccount_code ELSE NULL END AS paystack_subaccount_code,
        CASE WHEN v_is_owner THEN nin ELSE NULL END AS nin,
        CASE WHEN v_is_owner THEN bvn ELSE NULL END AS bvn,
        CASE WHEN v_is_owner THEN cac_rc_number ELSE NULL END AS cac_rc_number,
        CASE WHEN v_is_owner THEN tax_identification_number ELSE NULL END AS tax_identification_number,
        CASE WHEN v_is_owner THEN legal_entity_name ELSE NULL END AS legal_entity_name,
        support_email,
        support_phone,
        business_address,
        social_media,
        google_analytics_id,
        facebook_pixel_id,
        tiktok_pixel_id,
        snapchat_pixel_id,
        twitter_pixel_id,
        hero_slides
      FROM public.merchants
      WHERE id = v_merchant_id
    ) AS m;

    SELECT pg_catalog.to_jsonb(d)
      INTO v_domain_data
    FROM (
      SELECT id, domain, is_primary, status, domain_type
      FROM public.domains
      WHERE merchant_id = v_merchant_id
        AND is_primary = true
        AND status = 'active'
      LIMIT 1
    ) AS d;

    RETURN pg_catalog.jsonb_build_object(
      'merchant',
      v_merchant_data,
      'primaryDomain',
      COALESCE(v_domain_data, 'null'::jsonb)
    );
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.get_user_merchant_context() IS
  'Returns merchant and primary domain context, including plan entitlement fields and merchants.updated_at for mobile optimistic concurrency.';

REVOKE EXECUTE ON FUNCTION public.get_user_merchant_context() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_merchant_context() TO authenticated, service_role;
