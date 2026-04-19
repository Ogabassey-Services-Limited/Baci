-- Create a function to get the merchant context for the authenticated user
-- Used by useMerchant hook to resolve correct merchant for owners AND staff
-- Returns: JSON object { merchant: ..., primaryDomain: ... } or NULL

CREATE OR REPLACE FUNCTION get_user_merchant_context()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of the function creator (postgres/service_role)
SET search_path = public -- Explicitly set search_path for security
AS $$
DECLARE
  v_merchant_id uuid;
  v_user_id uuid := auth.uid();
  v_merchant_data jsonb;
  v_domain_data jsonb;
BEGIN
  -- 1. Check if user is an OWNER
  SELECT id INTO v_merchant_id 
  FROM merchants 
  WHERE user_id = v_user_id 
  LIMIT 1;

  -- 2. If not owner, check if user is active STAFF
  IF v_merchant_id IS NULL THEN
    SELECT merchant_id INTO v_merchant_id 
    FROM staff_members 
    WHERE user_id = v_user_id 
    AND status = 'active' 
    LIMIT 1;
  END IF;

  -- 3. If a merchant ID was found, fetch data
  IF v_merchant_id IS NOT NULL THEN
    -- Fetch Merchant Data
    -- We select specific columns to match the Merchant interface expected by the frontend
    SELECT to_jsonb(m) INTO v_merchant_data 
    FROM (
      SELECT 
        id, user_id, email, business_name, slug, logo_url, favicon_png_192_url, is_published, phone, 
        vat_registration_status, vat_rate, payout_currency, brand_colors,
        country, bank_code, bank_account_number, paystack_subaccount_code,
        nin, bvn, cac_rc_number, support_email, support_phone, business_address,
        social_media, google_analytics_id, facebook_pixel_id, tiktok_pixel_id, 
        snapchat_pixel_id, twitter_pixel_id, hero_slides
      FROM merchants
      WHERE id = v_merchant_id
    ) m;
    
    -- Fetch Primary Domain Data
    SELECT to_jsonb(d) INTO v_domain_data 
    FROM (
      SELECT id, domain, is_primary, status, domain_type
      FROM domains 
      WHERE merchant_id = v_merchant_id 
      AND is_primary = true 
      AND status = 'active'
      LIMIT 1
    ) d;
    
    -- Return combined object
    RETURN jsonb_build_object(
      'merchant', v_merchant_data,
      'primaryDomain', COALESCE(v_domain_data, 'null'::jsonb)
    );
  END IF;

  -- Return null if no context found
  RETURN NULL;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_merchant_context() TO authenticated;
