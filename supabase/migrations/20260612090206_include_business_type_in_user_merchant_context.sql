CREATE OR REPLACE FUNCTION public.get_user_merchant_context()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_merchant_id uuid;
  v_user_id uuid := auth.uid();
  v_merchant_data jsonb;
  v_domain_data jsonb;
BEGIN
  SELECT id INTO v_merchant_id
  FROM merchants
  WHERE user_id = v_user_id
    AND (business_name IS NOT NULL OR slug IS NOT NULL)
  ORDER BY id ASC
  LIMIT 1;

  IF v_merchant_id IS NULL THEN
    SELECT merchant_id INTO v_merchant_id
    FROM staff_members
    WHERE user_id = v_user_id
      AND status = 'active'
    ORDER BY id ASC
    LIMIT 1;
  END IF;

  IF v_merchant_id IS NOT NULL THEN
    SELECT to_jsonb(m) INTO v_merchant_data
    FROM (
      SELECT
        id, user_id, email, business_name, business_type, slug, logo_url,
        favicon_png_192_url, is_published, phone, vat_registration_status,
        vat_rate, payout_currency, brand_colors, country, bank_code,
        bank_account_number, bank_name, bank_account_name,
        paystack_subaccount_code, nin, bvn, cac_rc_number,
        tax_identification_number, legal_entity_name, support_email,
        support_phone, business_address, social_media, google_analytics_id,
        facebook_pixel_id, tiktok_pixel_id, snapchat_pixel_id,
        twitter_pixel_id, hero_slides
      FROM merchants
      WHERE id = v_merchant_id
    ) AS m;

    SELECT to_jsonb(d) INTO v_domain_data
    FROM (
      SELECT id, domain, is_primary, status, domain_type
      FROM domains
      WHERE merchant_id = v_merchant_id
        AND is_primary = true
        AND status = 'active'
      LIMIT 1
    ) AS d;

    RETURN jsonb_build_object(
      'merchant', v_merchant_data,
      'primaryDomain', COALESCE(v_domain_data, 'null'::jsonb)
    );
  END IF;

  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_merchant_context() TO authenticated;
