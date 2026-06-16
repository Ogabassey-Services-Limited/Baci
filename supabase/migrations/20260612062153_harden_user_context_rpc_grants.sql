-- Harden authenticated user-context RPCs exposed through PostgREST.
--
-- These helpers are used after app auth has already produced a signed-in
-- Supabase client. Anonymous callers have no valid context for either result.

CREATE OR REPLACE FUNCTION public.get_user_access()
RETURNS TABLE(
  merchant_id uuid,
  role text,
  is_owner boolean,
  is_staff boolean,
  permissions jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_owner_id uuid;
  v_staff record;
  v_default_permissions jsonb;
  v_permissions jsonb;
  resource text;
  actions jsonb;
BEGIN
  IF COALESCE((SELECT auth.role()), '') NOT IN ('authenticated', 'service_role')
    OR v_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT m.id
    INTO v_owner_id
  FROM public.merchants AS m
  WHERE m.user_id = v_user_id
  LIMIT 1;

  IF v_owner_id IS NOT NULL THEN
    merchant_id := v_owner_id;
    role := 'owner';
    is_owner := true;
    is_staff := false;
    permissions := pg_catalog.jsonb_build_object(
      '*',
      pg_catalog.jsonb_build_object('*', true)
    );
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT sm.merchant_id, sm.role, sm.permissions
    INTO v_staff
  FROM public.staff_members AS sm
  WHERE sm.user_id = v_user_id
    AND sm.status = 'active'
  LIMIT 1;

  IF v_staff.merchant_id IS NULL THEN
    RETURN;
  END IF;

  SELECT rp.permissions
    INTO v_default_permissions
  FROM public.role_permissions AS rp
  WHERE rp.role = v_staff.role;

  v_permissions := COALESCE(v_default_permissions, '{}'::jsonb);

  IF v_staff.permissions IS NOT NULL THEN
    FOR resource, actions IN
      SELECT e.key, e.value
      FROM pg_catalog.jsonb_each(v_staff.permissions) AS e(key, value)
    LOOP
      v_permissions := pg_catalog.jsonb_set(
        v_permissions,
        ARRAY[resource],
        COALESCE(v_permissions -> resource, '{}'::jsonb) || actions,
        true
      );
    END LOOP;
  END IF;

  merchant_id := v_staff.merchant_id;
  role := v_staff.role::text;
  is_owner := false;
  is_staff := true;
  permissions := v_permissions;

  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.get_user_access() IS
  'Returns owner or active staff access for the current signed-in caller.';

CREATE OR REPLACE FUNCTION public.get_user_merchant_context()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_merchant_id uuid;
  v_user_id uuid := (SELECT auth.uid());
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
  LIMIT 1;

  IF v_merchant_id IS NULL THEN
    SELECT sm.merchant_id
      INTO v_merchant_id
    FROM public.staff_members AS sm
    WHERE sm.user_id = v_user_id
      AND sm.status = 'active'
    LIMIT 1;
  END IF;

  IF v_merchant_id IS NOT NULL THEN
    SELECT pg_catalog.to_jsonb(m)
      INTO v_merchant_data
    FROM (
      SELECT
        id, user_id, email, business_name, slug, logo_url, favicon_png_192_url,
        is_published, phone, vat_registration_status, vat_rate,
        payout_currency, brand_colors, country, bank_code,
        bank_account_number, bank_name, bank_account_name,
        paystack_subaccount_code, nin, bvn, cac_rc_number,
        tax_identification_number, legal_entity_name, support_email,
        support_phone, business_address, social_media, google_analytics_id,
        facebook_pixel_id, tiktok_pixel_id, snapchat_pixel_id,
        twitter_pixel_id, hero_slides
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
  'Returns merchant and primary domain context for the current signed-in caller.';

REVOKE EXECUTE ON FUNCTION public.get_user_access()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_access()
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_user_merchant_context()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_merchant_context()
  TO authenticated, service_role;
