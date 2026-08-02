-- Rebuild bounded writers on static safe projections so all immutable asset
-- URLs omit credentials, query parameters, and fragments.

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
  ];
  v_presence_fields text[] := ARRAY[
    'business_address', 'email', 'lga_code', 'phone', 'registered_address',
    'state_code'
  ];
  v_old_exact_values jsonb := '{}'::jsonb;
  v_new_exact_values jsonb := '{}'::jsonb;
  v_old_presence_values jsonb := '{}'::jsonb;
  v_new_presence_values jsonb := '{}'::jsonb;
  v_before_values jsonb := '{}'::jsonb;
  v_after_values jsonb := '{}'::jsonb;
  v_changed_fields text[] := ARRAY[]::text[];
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
    v_old_exact_values := private.project_merchant_identity_exact_values_v3(OLD);
    v_old_presence_values := private.project_merchant_identity_presence_values_v3(OLD);
  ELSIF TG_OP = 'INSERT' THEN
    v_merchant_id := NEW.id;
    v_merchant_label := NULLIF(pg_catalog.btrim(NEW.business_name), '');
    v_action := 'merchant.identity.create';
    v_new_exact_values := private.project_merchant_identity_exact_values_v3(NEW);
    v_new_presence_values := private.project_merchant_identity_presence_values_v3(NEW);
  ELSE
    v_merchant_id := NEW.id;
    v_merchant_label := NULLIF(pg_catalog.btrim(NEW.business_name), '');
    v_action := 'merchant.identity.update';
    v_old_exact_values := private.project_merchant_identity_exact_values_v3(OLD);
    v_new_exact_values := private.project_merchant_identity_exact_values_v3(NEW);
    v_old_presence_values := private.project_merchant_identity_presence_values_v3(OLD);
    v_new_presence_values := private.project_merchant_identity_presence_values_v3(NEW);
  END IF;

  IF v_merchant_id IS NULL THEN
    RAISE EXCEPTION 'audit_merchant_identity_id_required' USING ERRCODE = '22023';
  END IF;
  IF v_merchant_label IS NOT NULL AND pg_catalog.char_length(v_merchant_label) > 160 THEN
    v_merchant_label := NULL;
  END IF;

  FOREACH v_field IN ARRAY v_exact_fields LOOP
    IF TG_OP = 'INSERT' AND (v_new_exact_values -> v_field) IS DISTINCT FROM 'null'::jsonb THEN
      v_changed_fields := pg_catalog.array_append(v_changed_fields, v_field);
      v_after_values := v_after_values || pg_catalog.jsonb_build_object(v_field, v_new_exact_values -> v_field);
    ELSIF TG_OP = 'DELETE' AND (v_old_exact_values -> v_field) IS DISTINCT FROM 'null'::jsonb THEN
      v_changed_fields := pg_catalog.array_append(v_changed_fields, v_field);
      v_before_values := v_before_values || pg_catalog.jsonb_build_object(v_field, v_old_exact_values -> v_field);
    ELSIF TG_OP = 'UPDATE' AND (CASE v_field
      WHEN 'email_logo_url' THEN OLD.email_logo_url IS DISTINCT FROM NEW.email_logo_url
      WHEN 'favicon_apple_touch_url' THEN OLD.favicon_apple_touch_url IS DISTINCT FROM NEW.favicon_apple_touch_url
      WHEN 'favicon_png_192_url' THEN OLD.favicon_png_192_url IS DISTINCT FROM NEW.favicon_png_192_url
      WHEN 'favicon_png_32_url' THEN OLD.favicon_png_32_url IS DISTINCT FROM NEW.favicon_png_32_url
      WHEN 'favicon_svg_url' THEN OLD.favicon_svg_url IS DISTINCT FROM NEW.favicon_svg_url
      WHEN 'logo_url' THEN OLD.logo_url IS DISTINCT FROM NEW.logo_url
      ELSE (v_old_exact_values -> v_field) IS DISTINCT FROM (v_new_exact_values -> v_field)
    END) THEN
      v_changed_fields := pg_catalog.array_append(v_changed_fields, v_field);
      v_before_values := v_before_values || pg_catalog.jsonb_build_object(v_field, v_old_exact_values -> v_field);
      v_after_values := v_after_values || pg_catalog.jsonb_build_object(v_field, v_new_exact_values -> v_field);
    END IF;
  END LOOP;

  FOREACH v_field IN ARRAY v_presence_fields LOOP
    IF TG_OP = 'INSERT' AND (v_new_presence_values -> v_field ->> 'present') = 'true' THEN
      v_changed_fields := pg_catalog.array_append(v_changed_fields, v_field);
      v_after_values := v_after_values || pg_catalog.jsonb_build_object(v_field, v_new_presence_values -> v_field);
    ELSIF TG_OP = 'DELETE' AND (v_old_presence_values -> v_field ->> 'present') = 'true' THEN
      v_changed_fields := pg_catalog.array_append(v_changed_fields, v_field);
      v_before_values := v_before_values || pg_catalog.jsonb_build_object(v_field, v_old_presence_values -> v_field);
    ELSIF TG_OP = 'UPDATE' AND (CASE v_field
      WHEN 'business_address' THEN OLD.business_address IS DISTINCT FROM NEW.business_address
      WHEN 'email' THEN OLD.email IS DISTINCT FROM NEW.email
      WHEN 'lga_code' THEN OLD.lga_code IS DISTINCT FROM NEW.lga_code
      WHEN 'phone' THEN OLD.phone IS DISTINCT FROM NEW.phone
      WHEN 'registered_address' THEN OLD.registered_address IS DISTINCT FROM NEW.registered_address
      WHEN 'state_code' THEN OLD.state_code IS DISTINCT FROM NEW.state_code
      ELSE false
    END) THEN
      v_changed_fields := pg_catalog.array_append(v_changed_fields, v_field);
      v_before_values := v_before_values || pg_catalog.jsonb_build_object(v_field, v_old_presence_values -> v_field);
      v_after_values := v_after_values || pg_catalog.jsonb_build_object(v_field, v_new_presence_values -> v_field);
    END IF;
  END LOOP;

  IF pg_catalog.cardinality(v_changed_fields) = 0 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF pg_catalog.octet_length(v_before_values::text) > 16384
    OR pg_catalog.octet_length(v_after_values::text) > 16384 THEN
    RAISE EXCEPTION 'audit_merchant_identity_payload_too_large' USING ERRCODE = '54000';
  END IF;

  SELECT capability.capability INTO v_writer_capability
  FROM private.audit_event_writer_capabilities AS capability
  WHERE capability.capability_name = 'canonical_audit_event_writer_v1';
  IF v_writer_capability IS NULL THEN
    RAISE EXCEPTION 'audit_merchant_identity_writer_capability_unavailable' USING ERRCODE = '42501';
  END IF;
  PERFORM private.write_audit_event_v1(
    v_merchant_id, v_merchant_label, v_action, 'merchant'::text,
    v_merchant_id::text, v_changed_fields, NULLIF(v_before_values, '{}'::jsonb),
    NULLIF(v_after_values, '{}'::jsonb), NULL::uuid, NULL::uuid, 1::smallint,
    pg_catalog.jsonb_build_object('category', 'merchant_identity', 'operation', pg_catalog.lower(TG_OP)),
    v_writer_capability
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

ALTER FUNCTION private.audit_merchant_identity_change_v1() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.audit_merchant_identity_change_v1()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.audit_merchant_identity_raw_social_change_v2()
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
  ];
  v_presence_fields text[] := ARRAY[
    'business_address', 'email', 'lga_code', 'phone', 'registered_address',
    'state_code'
  ];
  v_old_exact_values jsonb;
  v_new_exact_values jsonb;
  v_old_presence_values jsonb;
  v_new_presence_values jsonb;
  v_before_values jsonb := '{}'::jsonb;
  v_after_values jsonb := '{}'::jsonb;
  v_changed_fields text[] := ARRAY[]::text[];
  v_field text;
  v_merchant_label text;
  v_writer_capability uuid;
BEGIN
  IF OLD.social_media IS NOT DISTINCT FROM NEW.social_media
    OR NOT private.merchant_identity_audit_row_is_bounded_v2(OLD)
    OR NOT private.merchant_identity_audit_row_is_bounded_v2(NEW)
    OR private.project_merchant_social_media_for_audit_v1(OLD.social_media)
      IS DISTINCT FROM private.project_merchant_social_media_for_audit_v1(NEW.social_media) THEN
    RETURN NEW;
  END IF;

  v_old_exact_values := private.project_merchant_identity_exact_values_v3(OLD);
  v_new_exact_values := private.project_merchant_identity_exact_values_v3(NEW);
  v_old_presence_values := private.project_merchant_identity_presence_values_v3(OLD);
  v_new_presence_values := private.project_merchant_identity_presence_values_v3(NEW);
  FOREACH v_field IN ARRAY v_exact_fields LOOP
    IF v_field = 'social_media' OR (CASE v_field
      WHEN 'email_logo_url' THEN OLD.email_logo_url IS DISTINCT FROM NEW.email_logo_url
      WHEN 'favicon_apple_touch_url' THEN OLD.favicon_apple_touch_url IS DISTINCT FROM NEW.favicon_apple_touch_url
      WHEN 'favicon_png_192_url' THEN OLD.favicon_png_192_url IS DISTINCT FROM NEW.favicon_png_192_url
      WHEN 'favicon_png_32_url' THEN OLD.favicon_png_32_url IS DISTINCT FROM NEW.favicon_png_32_url
      WHEN 'favicon_svg_url' THEN OLD.favicon_svg_url IS DISTINCT FROM NEW.favicon_svg_url
      WHEN 'logo_url' THEN OLD.logo_url IS DISTINCT FROM NEW.logo_url
      ELSE (v_old_exact_values -> v_field) IS DISTINCT FROM (v_new_exact_values -> v_field)
    END) THEN
      v_changed_fields := pg_catalog.array_append(v_changed_fields, v_field);
      v_before_values := v_before_values || pg_catalog.jsonb_build_object(v_field, v_old_exact_values -> v_field);
      v_after_values := v_after_values || pg_catalog.jsonb_build_object(v_field, v_new_exact_values -> v_field);
    END IF;
  END LOOP;
  FOREACH v_field IN ARRAY v_presence_fields LOOP
    IF (CASE v_field
      WHEN 'business_address' THEN OLD.business_address IS DISTINCT FROM NEW.business_address
      WHEN 'email' THEN OLD.email IS DISTINCT FROM NEW.email
      WHEN 'lga_code' THEN OLD.lga_code IS DISTINCT FROM NEW.lga_code
      WHEN 'phone' THEN OLD.phone IS DISTINCT FROM NEW.phone
      WHEN 'registered_address' THEN OLD.registered_address IS DISTINCT FROM NEW.registered_address
      WHEN 'state_code' THEN OLD.state_code IS DISTINCT FROM NEW.state_code
      ELSE false
    END) THEN
      v_changed_fields := pg_catalog.array_append(v_changed_fields, v_field);
      v_before_values := v_before_values || pg_catalog.jsonb_build_object(v_field, v_old_presence_values -> v_field);
      v_after_values := v_after_values || pg_catalog.jsonb_build_object(v_field, v_new_presence_values -> v_field);
    END IF;
  END LOOP;
  IF pg_catalog.octet_length(v_before_values::text) > 16384
    OR pg_catalog.octet_length(v_after_values::text) > 16384 THEN
    RAISE EXCEPTION 'audit_merchant_identity_payload_too_large' USING ERRCODE = '54000';
  END IF;
  v_merchant_label := NULLIF(pg_catalog.btrim(NEW.business_name), '');
  IF v_merchant_label IS NOT NULL AND pg_catalog.char_length(v_merchant_label) > 160 THEN
    v_merchant_label := NULL;
  END IF;
  SELECT capability.capability INTO v_writer_capability
  FROM private.audit_event_writer_capabilities AS capability
  WHERE capability.capability_name = 'canonical_audit_event_writer_v1';
  IF v_writer_capability IS NULL THEN
    RAISE EXCEPTION 'audit_merchant_identity_writer_capability_unavailable' USING ERRCODE = '42501';
  END IF;
  PERFORM private.write_audit_event_v1(
    NEW.id, v_merchant_label, 'merchant.identity.update', 'merchant'::text,
    NEW.id::text, v_changed_fields, NULLIF(v_before_values, '{}'::jsonb),
    NULLIF(v_after_values, '{}'::jsonb), NULL::uuid, NULL::uuid, 1::smallint,
    pg_catalog.jsonb_build_object('category', 'merchant_identity', 'operation', 'update'),
    v_writer_capability
  );
  RETURN NEW;
END;
$$;

ALTER FUNCTION private.audit_merchant_identity_raw_social_change_v2() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.audit_merchant_identity_raw_social_change_v2()
  FROM PUBLIC, anon, authenticated, service_role;
