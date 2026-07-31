-- Preserve clean-up and deletion of legacy oversized identity rows without
-- serializing their raw values into the immutable audit ledger.

CREATE OR REPLACE FUNCTION private.audit_merchant_identity_oversized_cleanup_v2()
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
  v_old_exact_values jsonb := '{}'::jsonb;
  v_new_exact_values jsonb := '{}'::jsonb;
  v_old_presence_values jsonb := '{}'::jsonb;
  v_new_presence_values jsonb := '{}'::jsonb;
  v_before_values jsonb := '{}'::jsonb;
  v_after_values jsonb := '{}'::jsonb;
  v_changed_fields text[] := ARRAY[]::text[];
  v_presence_changed_fields text[] := ARRAY[]::text[];
  v_redacted_marker jsonb := pg_catalog.jsonb_build_object(
    'state', 'redacted', 'reason', 'oversized_legacy_payload'
  );
  v_field text;
  v_merchant_id uuid;
  v_merchant_label text;
  v_action text;
  v_writer_capability uuid;
BEGIN
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
    v_merchant_label := NULL;
  END IF;

  IF TG_OP <> 'INSERT' THEN
    v_old_exact_values := pg_catalog.jsonb_build_object(
      'business_name', OLD.business_name, 'country', OLD.country,
      'email_logo_url', OLD.email_logo_url, 'email_sender_name', OLD.email_sender_name,
      'favicon_apple_touch_url', OLD.favicon_apple_touch_url,
      'favicon_png_192_url', OLD.favicon_png_192_url,
      'favicon_png_32_url', OLD.favicon_png_32_url, 'favicon_svg_url', OLD.favicon_svg_url,
      'is_published', OLD.is_published, 'legal_entity_name', OLD.legal_entity_name,
      'logo_url', OLD.logo_url, 'site_description', OLD.site_description,
      'site_tagline', OLD.site_tagline, 'site_title', OLD.site_title, 'slug', OLD.slug,
      'social_media', OLD.social_media, 'support_email', OLD.support_email,
      'support_phone', OLD.support_phone
    );
    v_old_presence_values := pg_catalog.jsonb_build_object(
      'business_address', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.business_address), '') IS NOT NULL),
      'email', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.email), '') IS NOT NULL),
      'lga_code', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.lga_code), '') IS NOT NULL),
      'phone', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.phone), '') IS NOT NULL),
      'registered_address', pg_catalog.jsonb_build_object('present', OLD.registered_address IS NOT NULL AND OLD.registered_address <> '{}'::jsonb),
      'state_code', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(OLD.state_code), '') IS NOT NULL)
    );
  END IF;
  IF TG_OP <> 'DELETE' THEN
    v_new_exact_values := pg_catalog.jsonb_build_object(
      'business_name', NEW.business_name, 'country', NEW.country,
      'email_logo_url', NEW.email_logo_url, 'email_sender_name', NEW.email_sender_name,
      'favicon_apple_touch_url', NEW.favicon_apple_touch_url,
      'favicon_png_192_url', NEW.favicon_png_192_url,
      'favicon_png_32_url', NEW.favicon_png_32_url, 'favicon_svg_url', NEW.favicon_svg_url,
      'is_published', NEW.is_published, 'legal_entity_name', NEW.legal_entity_name,
      'logo_url', NEW.logo_url, 'site_description', NEW.site_description,
      'site_tagline', NEW.site_tagline, 'site_title', NEW.site_title, 'slug', NEW.slug,
      'social_media', NEW.social_media, 'support_email', NEW.support_email,
      'support_phone', NEW.support_phone
    );
    v_new_presence_values := pg_catalog.jsonb_build_object(
      'business_address', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.business_address), '') IS NOT NULL),
      'email', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.email), '') IS NOT NULL),
      'lga_code', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.lga_code), '') IS NOT NULL),
      'phone', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.phone), '') IS NOT NULL),
      'registered_address', pg_catalog.jsonb_build_object('present', NEW.registered_address IS NOT NULL AND NEW.registered_address <> '{}'::jsonb),
      'state_code', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(NEW.state_code), '') IS NOT NULL)
    );
  END IF;

  FOREACH v_field IN ARRAY v_exact_fields LOOP
    IF TG_OP = 'INSERT' AND (v_new_exact_values -> v_field) IS DISTINCT FROM 'null'::jsonb THEN
      v_changed_fields := pg_catalog.array_append(v_changed_fields, v_field);
      v_after_values := v_after_values || pg_catalog.jsonb_build_object(v_field, v_redacted_marker);
    ELSIF TG_OP = 'DELETE' AND (v_old_exact_values -> v_field) IS DISTINCT FROM 'null'::jsonb THEN
      v_changed_fields := pg_catalog.array_append(v_changed_fields, v_field);
      v_before_values := v_before_values || pg_catalog.jsonb_build_object(v_field, v_redacted_marker);
    ELSIF TG_OP = 'UPDATE'
      AND (v_old_exact_values -> v_field) IS DISTINCT FROM (v_new_exact_values -> v_field) THEN
      v_changed_fields := pg_catalog.array_append(v_changed_fields, v_field);
      v_before_values := v_before_values || pg_catalog.jsonb_build_object(v_field, v_redacted_marker);
      v_after_values := v_after_values || pg_catalog.jsonb_build_object(v_field, v_redacted_marker);
    END IF;
  END LOOP;

  IF TG_OP = 'INSERT' THEN
    FOREACH v_field IN ARRAY v_presence_fields LOOP
      IF (v_new_presence_values -> v_field ->> 'present') = 'true' THEN
        v_presence_changed_fields := pg_catalog.array_append(v_presence_changed_fields, v_field);
      END IF;
    END LOOP;
  ELSIF TG_OP = 'DELETE' THEN
    FOREACH v_field IN ARRAY v_presence_fields LOOP
      IF (v_old_presence_values -> v_field ->> 'present') = 'true' THEN
        v_presence_changed_fields := pg_catalog.array_append(v_presence_changed_fields, v_field);
      END IF;
    END LOOP;
  ELSE
    v_presence_changed_fields := pg_catalog.array_remove(ARRAY[
      CASE WHEN OLD.business_address IS DISTINCT FROM NEW.business_address THEN 'business_address' END,
      CASE WHEN OLD.email IS DISTINCT FROM NEW.email THEN 'email' END,
      CASE WHEN OLD.lga_code IS DISTINCT FROM NEW.lga_code THEN 'lga_code' END,
      CASE WHEN OLD.phone IS DISTINCT FROM NEW.phone THEN 'phone' END,
      CASE WHEN OLD.registered_address IS DISTINCT FROM NEW.registered_address THEN 'registered_address' END,
      CASE WHEN OLD.state_code IS DISTINCT FROM NEW.state_code THEN 'state_code' END
    ]::text[], NULL);
  END IF;

  FOREACH v_field IN ARRAY v_presence_changed_fields LOOP
    v_changed_fields := pg_catalog.array_append(v_changed_fields, v_field);
    IF TG_OP <> 'INSERT' THEN
      v_before_values := v_before_values || pg_catalog.jsonb_build_object(
        v_field, v_old_presence_values -> v_field
      );
    END IF;
    IF TG_OP <> 'DELETE' THEN
      v_after_values := v_after_values || pg_catalog.jsonb_build_object(
        v_field, v_new_presence_values -> v_field
      );
    END IF;
  END LOOP;

  IF pg_catalog.cardinality(v_changed_fields) = 0 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT capability.capability INTO v_writer_capability
  FROM private.audit_event_writer_capabilities AS capability
  WHERE capability.capability_name = 'canonical_audit_event_writer_v1';
  IF v_writer_capability IS NULL THEN
    RAISE EXCEPTION 'audit_merchant_identity_writer_capability_unavailable'
      USING ERRCODE = '42501';
  END IF;
  PERFORM private.write_audit_event_v1(
    v_merchant_id, v_merchant_label, v_action, 'merchant'::text,
    v_merchant_id::text, v_changed_fields, NULLIF(v_before_values, '{}'::jsonb),
    NULLIF(v_after_values, '{}'::jsonb), NULL::uuid, NULL::uuid, 1::smallint,
    pg_catalog.jsonb_build_object(
      'category', 'merchant_identity', 'operation', pg_catalog.lower(TG_OP)
    ), v_writer_capability
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

ALTER FUNCTION private.audit_merchant_identity_oversized_cleanup_v2()
  OWNER TO postgres;
REVOKE ALL ON FUNCTION private.audit_merchant_identity_oversized_cleanup_v2()
  FROM PUBLIC, anon, authenticated, service_role;
