-- Canonical audit coverage for merchant-owned identity and public storefront data.
-- Sensitive configuration remains deliberately outside this trigger's payload.

-- The settings path historically stores arbitrary bounded strings for several
-- social keys. Audit events are immutable, so project that legacy state through
-- a narrower, syntactic public contract instead of copying those values into
-- the ledger. This function never changes stored merchant state.
CREATE OR REPLACE FUNCTION private.project_merchant_social_media_for_audit_v1(
  p_social_media jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_result jsonb := '{}'::jsonb;
  v_social_key text;
  v_value text;
  v_match text[];
  v_projected text;
BEGIN
  IF p_social_media IS NULL
    OR pg_catalog.jsonb_typeof(p_social_media) IS DISTINCT FROM 'object' THEN
    RETURN v_result;
  END IF;

  FOREACH v_social_key IN ARRAY ARRAY[
    'twitter', 'facebook', 'instagram', 'tiktok', 'youtube', 'pinterest',
    'linkedin', 'snapchat'
  ]::text[] LOOP
    IF pg_catalog.jsonb_typeof(p_social_media -> v_social_key) <> 'string' THEN
      CONTINUE;
    END IF;

    v_value := NULLIF(
      pg_catalog.lower(pg_catalog.btrim(p_social_media ->> v_social_key)),
      ''
    );
    IF v_value IS NULL OR pg_catalog.octet_length(v_value) > 255 THEN
      CONTINUE;
    END IF;

    v_match := NULL;
    v_projected := NULL;
    CASE v_social_key
      WHEN 'twitter' THEN
        IF v_value ~ '^@[a-z0-9_]{1,15}$' THEN
          v_projected := v_value;
        ELSE
          v_match := pg_catalog.regexp_match(
            v_value,
            '^https://(www[.])?(x[.]com|twitter[.]com)/([a-z0-9_]{1,15})/?$'
          );
          IF v_match IS NOT NULL THEN
            v_projected := '@' || v_match[3];
          END IF;
        END IF;
      WHEN 'instagram' THEN
        IF v_value ~ '^@[a-z0-9][a-z0-9._]{0,29}$' THEN
          v_projected := v_value;
        ELSE
          v_match := pg_catalog.regexp_match(
            v_value,
            '^https://(www[.])?instagram[.]com/([a-z0-9][a-z0-9._]{0,29})/?$'
          );
          IF v_match IS NOT NULL THEN
            v_projected := '@' || v_match[2];
          END IF;
        END IF;
      WHEN 'tiktok' THEN
        IF v_value ~ '^@[a-z0-9][a-z0-9._]{0,23}$' THEN
          v_projected := v_value;
        ELSE
          v_match := pg_catalog.regexp_match(
            v_value,
            '^https://(www[.])?tiktok[.]com/@([a-z0-9][a-z0-9._]{0,23})/?$'
          );
          IF v_match IS NOT NULL THEN
            v_projected := '@' || v_match[2];
          END IF;
        END IF;
      WHEN 'snapchat' THEN
        IF v_value ~ '^@[a-z0-9][a-z0-9._-]{0,63}$' THEN
          v_projected := v_value;
        ELSE
          v_match := pg_catalog.regexp_match(
            v_value,
            '^https://(www[.])?snapchat[.]com/(add|@)/([a-z0-9][a-z0-9._-]{0,63})/?$'
          );
          IF v_match IS NOT NULL THEN
            v_projected := '@' || v_match[3];
          END IF;
        END IF;
      WHEN 'facebook' THEN
        v_match := pg_catalog.regexp_match(
          v_value,
          '^https://(www[.]|m[.])?facebook[.]com/([a-z0-9][a-z0-9._-]{0,63})/?$'
        );
        IF v_match IS NOT NULL THEN
          v_projected := 'https://facebook.com/' || v_match[2];
        END IF;
      WHEN 'youtube' THEN
        v_match := pg_catalog.regexp_match(
          v_value,
          '^https://(www[.])?youtube[.]com/@([a-z0-9][a-z0-9._-]{0,63})/?$'
        );
        IF v_match IS NOT NULL THEN
          v_projected := 'https://youtube.com/@' || v_match[2];
        END IF;
      WHEN 'pinterest' THEN
        v_match := pg_catalog.regexp_match(
          v_value,
          '^https://(www[.])?pinterest[.]com/([a-z0-9][a-z0-9._-]{0,63})/?$'
        );
        IF v_match IS NOT NULL THEN
          v_projected := 'https://pinterest.com/' || v_match[2];
        END IF;
      WHEN 'linkedin' THEN
        v_match := pg_catalog.regexp_match(
          v_value,
          '^https://(www[.])?linkedin[.]com/(in|company)/([a-z0-9][a-z0-9-]{0,99})/?$'
        );
        IF v_match IS NOT NULL THEN
          v_projected := 'https://linkedin.com/' || v_match[2] || '/' || v_match[3];
        END IF;
      ELSE
        v_projected := NULL;
    END CASE;

    IF v_projected IS NOT NULL THEN
      v_result := v_result || pg_catalog.jsonb_build_object(
        v_social_key,
        v_projected
      );
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$;

ALTER FUNCTION private.project_merchant_social_media_for_audit_v1(jsonb)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION private.project_merchant_social_media_for_audit_v1(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.audit_merchant_identity_change_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_exact_fields text[] := ARRAY[
    'business_name', 'country', 'email_logo_url', 'email_sender_name',
    'favicon_apple_touch_url', 'favicon_png_192_url', 'favicon_png_32_url',
    'favicon_svg_url', 'is_published', 'legal_entity_name', 'logo_url',
    'site_description', 'site_tagline', 'site_title', 'slug', 'social_media',
    'support_email', 'support_phone'
  ]::text[];
  v_presence_fields text[] := ARRAY[
    'business_address', 'email', 'lga_code', 'phone', 'registered_address',
    'state_code'
  ]::text[];
  v_delegated_fields text[] := ARRAY[
    'bank_account_name', 'bank_code', 'bank_name', 'email_domain',
    'email_domain_verified', 'endpoint_scheme_id', 'facebook_pixel_id',
    'feature_settings', 'firs_business_id', 'firs_service_id',
    'gmc_variants_enabled', 'google_analytics_id', 'is_platform_admin',
    'kyc_status', 'multi_currency_enabled', 'offline_conversions_enabled',
    'paystack_subaccount_code', 'payout_currency', 'plan_tier',
    'premium_features', 'snapchat_pixel_id', 'stripe_customer_id',
    'stripe_subscription_id', 'tax_exempt', 'tiktok_pixel_id',
    'twitter_pixel_id', 'user_id', 'vat_rate', 'vat_registration_status'
  ]::text[];
  v_forbidden_fields text[] := ARRAY[
    'bank_account_number', 'bvn', 'cac_number', 'cac_rc_number', 'endpoint_id',
    'facebook_capi_access_token', 'facebook_capi_token', 'firs_certificate',
    'firs_email', 'firs_password_encrypted', 'firs_public_key',
    'ga4_api_secret', 'google_product_sheet_url', 'nin', 'rider_phone_number',
    'snapchat_capi_token', 'tax_identification_number', 'tiktok_access_token',
    'virtual_terminal_code'
  ]::text[];
  v_ignored_fields text[] := ARRAY[
    'about_page', 'brand_colors', 'business_type', 'created_at',
    'favicon_uploaded_at', 'faq_items', 'hero_image_ids',
    'hero_images_generated_at', 'hero_images_regeneration_count', 'hero_slides',
    'id', 'mobile_hero_slides', 'order_prefix', 'pages', 'plan_expires_at',
    'plan_started_at', 'published_at', 'published_config',
    'self_fulfillment_enabled', 'signup_source', 'template_id', 'trust_profile',
    'updated_at'
  ]::text[];
  v_classified_fields text[];
  v_old_exact_values jsonb := '{}'::jsonb;
  v_new_exact_values jsonb := '{}'::jsonb;
  v_old_presence_values jsonb := '{}'::jsonb;
  v_new_presence_values jsonb := '{}'::jsonb;
  v_old_social_media jsonb := '{}'::jsonb;
  v_new_social_media jsonb := '{}'::jsonb;
  v_before_values jsonb := '{}'::jsonb;
  v_after_values jsonb := '{}'::jsonb;
  v_changed_fields text[] := ARRAY[]::text[];
  v_presence_changed_fields text[] := ARRAY[]::text[];
  v_field text;
  v_merchant_id uuid;
  v_merchant_label text;
  v_action text;
  v_writer_capability uuid;
BEGIN
  -- Keep the classification closed as public.merchants evolves: an unreviewed
  -- column must not silently become an unaudited identity value.
  v_classified_fields := v_exact_fields || v_presence_fields ||
    v_delegated_fields || v_forbidden_fields || v_ignored_fields;

  IF pg_catalog.cardinality(v_classified_fields) <> (
    SELECT pg_catalog.count(DISTINCT classified_field.name)
    FROM pg_catalog.unnest(v_classified_fields) AS classified_field(name)
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.unnest(v_classified_fields) AS classified_field(name)
    LEFT JOIN pg_catalog.pg_attribute AS attribute
      ON attribute.attrelid = 'public.merchants'::pg_catalog.regclass
      AND attribute.attname = classified_field.name
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
    WHERE attribute.attname IS NULL
  ) THEN
    RAISE EXCEPTION 'audit_merchant_identity_classification_invalid'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute AS attribute
    WHERE attribute.attrelid = 'public.merchants'::pg_catalog.regclass
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
      AND attribute.attname <> ALL(v_classified_fields)
  ) THEN
    RAISE EXCEPTION 'audit_merchant_identity_unclassified_column'
      USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_merchant_id := OLD.id;
    v_merchant_label := NULLIF(pg_catalog.btrim(OLD.business_name), '');
    v_action := 'merchant.identity.delete';
  ELSIF TG_OP = 'INSERT' THEN
    v_merchant_id := NEW.id;
    v_merchant_label := NULLIF(pg_catalog.btrim(NEW.business_name), '');
    v_action := 'merchant.identity.create';
  ELSE
    v_merchant_id := NEW.id;
    v_merchant_label := NULLIF(pg_catalog.btrim(NEW.business_name), '');
    v_action := 'merchant.identity.update';
  END IF;

  IF v_merchant_id IS NULL THEN
    RAISE EXCEPTION 'audit_merchant_identity_id_required' USING ERRCODE = '22023';
  END IF;
  IF v_merchant_label IS NOT NULL
    AND pg_catalog.char_length(v_merchant_label) > 160 THEN
    -- merchant_label is a convenience projection with a narrower ledger bound;
    -- preserve the exact business_name in before/after_values without blocking
    -- a governed write solely because this optional label is too long.
    v_merchant_label := NULL;
  END IF;

  IF TG_OP <> 'INSERT' THEN
    v_old_exact_values := pg_catalog.jsonb_build_object(
      'business_name', OLD.business_name,
      'country', OLD.country,
      'email_logo_url', OLD.email_logo_url,
      'email_sender_name', OLD.email_sender_name,
      'favicon_apple_touch_url', OLD.favicon_apple_touch_url,
      'favicon_png_192_url', OLD.favicon_png_192_url,
      'favicon_png_32_url', OLD.favicon_png_32_url,
      'favicon_svg_url', OLD.favicon_svg_url,
      'is_published', OLD.is_published,
      'legal_entity_name', OLD.legal_entity_name,
      'logo_url', OLD.logo_url,
      'site_description', OLD.site_description,
      'site_tagline', OLD.site_tagline,
      'site_title', OLD.site_title,
      'slug', OLD.slug,
      'support_email', OLD.support_email,
      'support_phone', OLD.support_phone
    );
    v_old_presence_values := pg_catalog.jsonb_build_object(
      'business_address', pg_catalog.jsonb_build_object(
        'present', NULLIF(pg_catalog.btrim(OLD.business_address), '') IS NOT NULL
      ),
      'email', pg_catalog.jsonb_build_object(
        'present', NULLIF(pg_catalog.btrim(OLD.email), '') IS NOT NULL
      ),
      'lga_code', pg_catalog.jsonb_build_object(
        'present', NULLIF(pg_catalog.btrim(OLD.lga_code), '') IS NOT NULL
      ),
      'phone', pg_catalog.jsonb_build_object(
        'present', NULLIF(pg_catalog.btrim(OLD.phone), '') IS NOT NULL
      ),
      'registered_address', pg_catalog.jsonb_build_object(
        'present', OLD.registered_address IS NOT NULL
          AND OLD.registered_address <> '{}'::jsonb
      ),
      'state_code', pg_catalog.jsonb_build_object(
        'present', NULLIF(pg_catalog.btrim(OLD.state_code), '') IS NOT NULL
      )
    );

    v_old_social_media := private.project_merchant_social_media_for_audit_v1(
      OLD.social_media
    );
  END IF;

  IF TG_OP <> 'DELETE' THEN
    v_new_exact_values := pg_catalog.jsonb_build_object(
      'business_name', NEW.business_name,
      'country', NEW.country,
      'email_logo_url', NEW.email_logo_url,
      'email_sender_name', NEW.email_sender_name,
      'favicon_apple_touch_url', NEW.favicon_apple_touch_url,
      'favicon_png_192_url', NEW.favicon_png_192_url,
      'favicon_png_32_url', NEW.favicon_png_32_url,
      'favicon_svg_url', NEW.favicon_svg_url,
      'is_published', NEW.is_published,
      'legal_entity_name', NEW.legal_entity_name,
      'logo_url', NEW.logo_url,
      'site_description', NEW.site_description,
      'site_tagline', NEW.site_tagline,
      'site_title', NEW.site_title,
      'slug', NEW.slug,
      'support_email', NEW.support_email,
      'support_phone', NEW.support_phone
    );
    v_new_presence_values := pg_catalog.jsonb_build_object(
      'business_address', pg_catalog.jsonb_build_object(
        'present', NULLIF(pg_catalog.btrim(NEW.business_address), '') IS NOT NULL
      ),
      'email', pg_catalog.jsonb_build_object(
        'present', NULLIF(pg_catalog.btrim(NEW.email), '') IS NOT NULL
      ),
      'lga_code', pg_catalog.jsonb_build_object(
        'present', NULLIF(pg_catalog.btrim(NEW.lga_code), '') IS NOT NULL
      ),
      'phone', pg_catalog.jsonb_build_object(
        'present', NULLIF(pg_catalog.btrim(NEW.phone), '') IS NOT NULL
      ),
      'registered_address', pg_catalog.jsonb_build_object(
        'present', NEW.registered_address IS NOT NULL
          AND NEW.registered_address <> '{}'::jsonb
      ),
      'state_code', pg_catalog.jsonb_build_object(
        'present', NULLIF(pg_catalog.btrim(NEW.state_code), '') IS NOT NULL
      )
    );

    v_new_social_media := private.project_merchant_social_media_for_audit_v1(
      NEW.social_media
    );
  END IF;

  FOREACH v_field IN ARRAY v_exact_fields LOOP
    IF v_field = 'social_media' THEN
      CONTINUE;
    END IF;

    IF TG_OP = 'INSERT' THEN
      IF (v_new_exact_values -> v_field) IS DISTINCT FROM 'null'::jsonb THEN
        v_changed_fields := pg_catalog.array_append(v_changed_fields, v_field);
        v_after_values := v_after_values || pg_catalog.jsonb_build_object(
          v_field,
          v_new_exact_values -> v_field
        );
      END IF;
    ELSIF TG_OP = 'DELETE' THEN
      IF (v_old_exact_values -> v_field) IS DISTINCT FROM 'null'::jsonb THEN
        v_changed_fields := pg_catalog.array_append(v_changed_fields, v_field);
        v_before_values := v_before_values || pg_catalog.jsonb_build_object(
          v_field,
          v_old_exact_values -> v_field
        );
      END IF;
    ELSIF (v_old_exact_values -> v_field)
      IS DISTINCT FROM (v_new_exact_values -> v_field) THEN
      v_changed_fields := pg_catalog.array_append(v_changed_fields, v_field);
      v_before_values := v_before_values || pg_catalog.jsonb_build_object(
        v_field,
        v_old_exact_values -> v_field
      );
      v_after_values := v_after_values || pg_catalog.jsonb_build_object(
        v_field,
        v_new_exact_values -> v_field
      );
    END IF;
  END LOOP;

  IF TG_OP = 'INSERT' AND v_new_social_media <> '{}'::jsonb THEN
    v_changed_fields := pg_catalog.array_append(v_changed_fields, 'social_media');
    v_after_values := v_after_values || pg_catalog.jsonb_build_object(
      'social_media',
      v_new_social_media
    );
  ELSIF TG_OP = 'DELETE' AND v_old_social_media <> '{}'::jsonb THEN
    v_changed_fields := pg_catalog.array_append(v_changed_fields, 'social_media');
    v_before_values := v_before_values || pg_catalog.jsonb_build_object(
      'social_media',
      v_old_social_media
    );
  ELSIF TG_OP = 'UPDATE'
    AND v_old_social_media IS DISTINCT FROM v_new_social_media THEN
    v_changed_fields := pg_catalog.array_append(v_changed_fields, 'social_media');
    v_before_values := v_before_values || pg_catalog.jsonb_build_object(
      'social_media',
      v_old_social_media
    );
    v_after_values := v_after_values || pg_catalog.jsonb_build_object(
      'social_media',
      v_new_social_media
    );
  END IF;

  IF TG_OP = 'INSERT' THEN
    FOREACH v_field IN ARRAY v_presence_fields LOOP
      IF (v_new_presence_values -> v_field ->> 'present') = 'true' THEN
        v_presence_changed_fields := pg_catalog.array_append(
          v_presence_changed_fields,
          v_field
        );
      END IF;
    END LOOP;
  ELSIF TG_OP = 'DELETE' THEN
    FOREACH v_field IN ARRAY v_presence_fields LOOP
      IF (v_old_presence_values -> v_field ->> 'present') = 'true' THEN
        v_presence_changed_fields := pg_catalog.array_append(
          v_presence_changed_fields,
          v_field
        );
      END IF;
    END LOOP;
  ELSE
    IF OLD.business_address IS DISTINCT FROM NEW.business_address THEN
      v_presence_changed_fields := pg_catalog.array_append(
        v_presence_changed_fields,
        'business_address'
      );
    END IF;
    IF OLD.email IS DISTINCT FROM NEW.email THEN
      v_presence_changed_fields := pg_catalog.array_append(v_presence_changed_fields, 'email');
    END IF;
    IF OLD.lga_code IS DISTINCT FROM NEW.lga_code THEN
      v_presence_changed_fields := pg_catalog.array_append(v_presence_changed_fields, 'lga_code');
    END IF;
    IF OLD.phone IS DISTINCT FROM NEW.phone THEN
      v_presence_changed_fields := pg_catalog.array_append(v_presence_changed_fields, 'phone');
    END IF;
    IF OLD.registered_address IS DISTINCT FROM NEW.registered_address THEN
      v_presence_changed_fields := pg_catalog.array_append(
        v_presence_changed_fields,
        'registered_address'
      );
    END IF;
    IF OLD.state_code IS DISTINCT FROM NEW.state_code THEN
      v_presence_changed_fields := pg_catalog.array_append(v_presence_changed_fields, 'state_code');
    END IF;
  END IF;

  FOREACH v_field IN ARRAY v_presence_changed_fields LOOP
    v_changed_fields := pg_catalog.array_append(v_changed_fields, v_field);
    IF TG_OP <> 'INSERT' THEN
      v_before_values := v_before_values || pg_catalog.jsonb_build_object(
        v_field,
        v_old_presence_values -> v_field
      );
    END IF;
    IF TG_OP <> 'DELETE' THEN
      v_after_values := v_after_values || pg_catalog.jsonb_build_object(
        v_field,
        v_new_presence_values -> v_field
      );
    END IF;
  END LOOP;

  IF pg_catalog.cardinality(v_changed_fields) = 0 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF pg_catalog.octet_length(v_before_values::text) > 16384
    OR pg_catalog.octet_length(v_after_values::text) > 16384 THEN
    RAISE EXCEPTION 'audit_merchant_identity_payload_too_large'
      USING ERRCODE = '54000';
  END IF;

  SELECT capability.capability
    INTO v_writer_capability
    FROM private.audit_event_writer_capabilities AS capability
   WHERE capability.capability_name = 'canonical_audit_event_writer_v1';

  IF v_writer_capability IS NULL THEN
    RAISE EXCEPTION 'audit_merchant_identity_writer_capability_unavailable'
      USING ERRCODE = '42501';
  END IF;

  PERFORM private.write_audit_event_v1(
    v_merchant_id,
    v_merchant_label,
    v_action,
    'merchant'::text,
    v_merchant_id::text,
    v_changed_fields,
    NULLIF(v_before_values, '{}'::jsonb),
    NULLIF(v_after_values, '{}'::jsonb),
    NULL::uuid,
    NULL::uuid,
    1::smallint,
    pg_catalog.jsonb_build_object(
      'category', 'merchant_identity',
      'operation', pg_catalog.lower(TG_OP)
    ),
    v_writer_capability
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

ALTER FUNCTION private.audit_merchant_identity_change_v1() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.audit_merchant_identity_change_v1()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS audit_merchant_identity_change_v1 ON public.merchants;
CREATE TRIGGER audit_merchant_identity_change_v1
  AFTER INSERT OR DELETE OR UPDATE OF
    business_name,
    country,
    email_logo_url,
    email_sender_name,
    favicon_apple_touch_url,
    favicon_png_192_url,
    favicon_png_32_url,
    favicon_svg_url,
    is_published,
    legal_entity_name,
    logo_url,
    site_description,
    site_tagline,
    site_title,
    slug,
    social_media,
    support_email,
    support_phone,
    business_address,
    email,
    lga_code,
    phone,
    registered_address,
    state_code
  ON public.merchants
  FOR EACH ROW
  EXECUTE FUNCTION private.audit_merchant_identity_change_v1();
