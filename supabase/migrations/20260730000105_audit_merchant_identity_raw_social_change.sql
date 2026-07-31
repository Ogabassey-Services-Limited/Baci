-- For a raw social-media mutation with an unchanged safe projection, take
-- ownership of the entire bounded update. This keeps it as one normal identity
-- event even when the same statement changes other governed fields.

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
  ]::text[];
  v_presence_fields text[] := ARRAY[
    'business_address', 'email', 'lga_code', 'phone', 'registered_address',
    'state_code'
  ]::text[];
  v_old_row jsonb;
  v_new_row jsonb;
  v_old_social_media jsonb;
  v_new_social_media jsonb;
  v_before_values jsonb := '{}'::jsonb;
  v_after_values jsonb := '{}'::jsonb;
  v_changed_fields text[] := ARRAY[]::text[];
  v_old_present boolean;
  v_new_present boolean;
  v_field text;
  v_merchant_label text;
  v_writer_capability uuid;
BEGIN
  IF OLD.social_media IS NOT DISTINCT FROM NEW.social_media
    OR NOT private.merchant_identity_audit_row_is_bounded_v2(OLD)
    OR NOT private.merchant_identity_audit_row_is_bounded_v2(NEW) THEN
    RETURN NEW;
  END IF;

  v_old_social_media := private.project_merchant_social_media_for_audit_v1(
    OLD.social_media
  );
  v_new_social_media := private.project_merchant_social_media_for_audit_v1(
    NEW.social_media
  );
  IF v_old_social_media IS DISTINCT FROM v_new_social_media THEN
    RETURN NEW;
  END IF;

  -- These complete row projections stay local to this function. Every output
  -- access below is constrained by the static field allowlists, and social
  -- media is always replaced by its safe projection before serialization.
  v_old_row := pg_catalog.to_jsonb(OLD);
  v_new_row := pg_catalog.to_jsonb(NEW);

  FOREACH v_field IN ARRAY v_exact_fields LOOP
    IF v_field = 'social_media' THEN
      v_changed_fields := pg_catalog.array_append(v_changed_fields, v_field);
      v_before_values := v_before_values || pg_catalog.jsonb_build_object(
        v_field, v_old_social_media
      );
      v_after_values := v_after_values || pg_catalog.jsonb_build_object(
        v_field, v_new_social_media
      );
    ELSIF (v_old_row -> v_field) IS DISTINCT FROM (v_new_row -> v_field) THEN
      v_changed_fields := pg_catalog.array_append(v_changed_fields, v_field);
      v_before_values := v_before_values || pg_catalog.jsonb_build_object(
        v_field, v_old_row -> v_field
      );
      v_after_values := v_after_values || pg_catalog.jsonb_build_object(
        v_field, v_new_row -> v_field
      );
    END IF;
  END LOOP;

  FOREACH v_field IN ARRAY v_presence_fields LOOP
    IF (v_old_row -> v_field) IS NOT DISTINCT FROM (v_new_row -> v_field) THEN
      CONTINUE;
    END IF;
    IF v_field = 'registered_address' THEN
      v_old_present := (v_old_row -> v_field) IS NOT NULL
        AND (v_old_row -> v_field) <> 'null'::jsonb
        AND (v_old_row -> v_field) <> '{}'::jsonb;
      v_new_present := (v_new_row -> v_field) IS NOT NULL
        AND (v_new_row -> v_field) <> 'null'::jsonb
        AND (v_new_row -> v_field) <> '{}'::jsonb;
    ELSE
      v_old_present := NULLIF(
        pg_catalog.btrim(v_old_row ->> v_field), ''
      ) IS NOT NULL;
      v_new_present := NULLIF(
        pg_catalog.btrim(v_new_row ->> v_field), ''
      ) IS NOT NULL;
    END IF;
    v_changed_fields := pg_catalog.array_append(v_changed_fields, v_field);
    v_before_values := v_before_values || pg_catalog.jsonb_build_object(
      v_field, pg_catalog.jsonb_build_object('present', v_old_present)
    );
    v_after_values := v_after_values || pg_catalog.jsonb_build_object(
      v_field, pg_catalog.jsonb_build_object('present', v_new_present)
    );
  END LOOP;

  IF pg_catalog.octet_length(v_before_values::text) > 16384
    OR pg_catalog.octet_length(v_after_values::text) > 16384 THEN
    RAISE EXCEPTION 'audit_merchant_identity_payload_too_large'
      USING ERRCODE = '54000';
  END IF;

  v_merchant_label := NULLIF(pg_catalog.btrim(NEW.business_name), '');
  IF v_merchant_label IS NOT NULL
    AND pg_catalog.char_length(v_merchant_label) > 160 THEN
    v_merchant_label := NULL;
  END IF;

  SELECT capability.capability INTO v_writer_capability
  FROM private.audit_event_writer_capabilities AS capability
  WHERE capability.capability_name = 'canonical_audit_event_writer_v1';
  IF v_writer_capability IS NULL THEN
    RAISE EXCEPTION 'audit_merchant_identity_writer_capability_unavailable'
      USING ERRCODE = '42501';
  END IF;

  PERFORM private.write_audit_event_v1(
    NEW.id,
    v_merchant_label,
    'merchant.identity.update',
    'merchant'::text,
    NEW.id::text,
    v_changed_fields,
    NULLIF(v_before_values, '{}'::jsonb),
    NULLIF(v_after_values, '{}'::jsonb),
    NULL::uuid,
    NULL::uuid,
    1::smallint,
    pg_catalog.jsonb_build_object(
      'category', 'merchant_identity', 'operation', 'update'
    ),
    v_writer_capability
  );
  RETURN NEW;
END;
$$;

ALTER FUNCTION private.audit_merchant_identity_raw_social_change_v2()
  OWNER TO postgres;
REVOKE ALL ON FUNCTION private.audit_merchant_identity_raw_social_change_v2()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS audit_merchant_identity_raw_social_change_v2 ON public.merchants;
CREATE TRIGGER audit_merchant_identity_raw_social_change_v2
  AFTER UPDATE OF social_media ON public.merchants
  FOR EACH ROW
  WHEN (
    OLD.social_media IS DISTINCT FROM NEW.social_media
    AND private.merchant_identity_audit_row_is_bounded_v2(OLD)
    AND private.merchant_identity_audit_row_is_bounded_v2(NEW)
    AND private.project_merchant_social_media_for_audit_v1(OLD.social_media)
      IS NOT DISTINCT FROM private.project_merchant_social_media_for_audit_v1(NEW.social_media)
  )
  EXECUTE FUNCTION private.audit_merchant_identity_raw_social_change_v2();
