-- Canonical audit coverage for the private payment-credential vault. Events
-- retain slot/lifecycle evidence only; ciphertext, last-four, validation
-- errors, disabled reasons, and all derived secret fragments stay private.
CREATE OR REPLACE FUNCTION private.audit_payment_credential_presence_state_v1(
  p_old_present boolean, p_new_present boolean
) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
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
ALTER FUNCTION private.audit_payment_credential_presence_state_v1(boolean, boolean) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.audit_payment_credential_presence_state_v1(boolean, boolean) FROM PUBLIC, anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION private.audit_payment_credential_slot_v1(
  p_provider text, p_credential_role text, p_environment text, p_kek_version smallint
) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT pg_catalog.jsonb_build_object(
    'provider', p_provider,
    'credential_role', p_credential_role,
    'environment', p_environment,
    'kek_version', CASE WHEN p_kek_version BETWEEN 1 AND 32767
      THEN pg_catalog.to_jsonb(p_kek_version) ELSE '"out_of_bounds"'::jsonb END
  );
$$;
ALTER FUNCTION private.audit_payment_credential_slot_v1(text, text, text, smallint) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.audit_payment_credential_slot_v1(text, text, text, smallint) FROM PUBLIC, anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION private.audit_payment_credential_active_state_v1(
  p_is_active boolean, p_disabled_at timestamptz, p_disabled_reason text
) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT pg_catalog.jsonb_build_object(
    'state', CASE WHEN COALESCE(p_is_active, false) THEN 'active' ELSE 'inactive' END,
    'disabled_at_present', p_disabled_at IS NOT NULL,
    'disabled_reason_present', NULLIF(pg_catalog.btrim(p_disabled_reason), '') IS NOT NULL
  );
$$;
ALTER FUNCTION private.audit_payment_credential_active_state_v1(boolean, timestamptz, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.audit_payment_credential_active_state_v1(boolean, timestamptz, text) FROM PUBLIC, anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION private.audit_payment_credential_validation_state_v1(
  p_last_validated_at timestamptz, p_last_validation_error text
) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT pg_catalog.jsonb_build_object(
    'state', CASE WHEN NULLIF(pg_catalog.btrim(p_last_validation_error), '') IS NOT NULL THEN 'failed'
      WHEN p_last_validated_at IS NOT NULL THEN 'validated' ELSE 'unvalidated' END,
    'last_validated_at_present', p_last_validated_at IS NOT NULL,
    'error_present', NULLIF(pg_catalog.btrim(p_last_validation_error), '') IS NOT NULL
  );
$$;
ALTER FUNCTION private.audit_payment_credential_validation_state_v1(timestamptz, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.audit_payment_credential_validation_state_v1(timestamptz, text) FROM PUBLIC, anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION private.audit_payment_credential_change_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  -- Exact fields retain bounded safe values; presence fields become generic
  -- lifecycle states; ignored fields emit nothing; forbidden fields never enter snapshots.
  v_exact_fields text[] := ARRAY['credential_role', 'environment', 'is_active', 'kek_version', 'provider']::text[];
  v_presence_fields text[] := ARRAY['ciphertext', 'disabled_at', 'last_validated_at']::text[];
  v_ignored_fields text[] := ARRAY['created_at', 'updated_at']::text[];
  v_forbidden_fields text[] := ARRAY['disabled_reason', 'id', 'key_last4', 'last_validation_error', 'merchant_id']::text[];
  v_classified_fields text[]; v_missing_classified_field boolean := false;
  v_unclassified_live_field boolean := false; v_merchant_id uuid; v_merchant_label text;
  v_credential_id uuid; v_action text;
  v_is_cascade boolean := false;
  v_old_slot jsonb := '{}'::jsonb; v_new_slot jsonb := '{}'::jsonb;
  v_old_active_state jsonb := '{}'::jsonb; v_new_active_state jsonb := '{}'::jsonb;
  v_old_validation_state jsonb := '{}'::jsonb; v_new_validation_state jsonb := '{}'::jsonb;
  v_old_credential_state jsonb := pg_catalog.jsonb_build_object('present', true);
  v_new_credential_state jsonb := '{}'::jsonb; v_before_values jsonb := '{}'::jsonb;
  v_after_values jsonb := '{}'::jsonb; v_changed_fields text[] := ARRAY[]::text[];
  v_credential_changed boolean := false; v_active_changed boolean := false;
  v_validation_changed boolean := false;
  v_writer_capability uuid;
BEGIN
  v_classified_fields := v_exact_fields || v_presence_fields || v_ignored_fields || v_forbidden_fields;
  IF pg_catalog.cardinality(v_classified_fields) <> (SELECT pg_catalog.count(DISTINCT classified_field.name)
    FROM pg_catalog.unnest(v_classified_fields) AS classified_field(name)) THEN
    RAISE EXCEPTION 'audit_payment_credential_classification_invalid' USING ERRCODE = '55000';
  END IF;
  WITH live_columns AS (
    SELECT attribute.attname AS name FROM pg_catalog.pg_attribute AS attribute
    WHERE attribute.attrelid = 'private.merchant_payment_credentials'::pg_catalog.regclass
      AND attribute.attnum > 0 AND NOT attribute.attisdropped
  ), classification_comparison AS (
    SELECT classified_field.name AS classified_name, live_column.name AS live_name
    FROM pg_catalog.unnest(v_classified_fields) AS classified_field(name)
    FULL OUTER JOIN live_columns AS live_column ON live_column.name = classified_field.name
  ) SELECT COALESCE(pg_catalog.bool_or(classified_name IS NOT NULL AND live_name IS NULL), false),
      COALESCE(pg_catalog.bool_or(classified_name IS NULL AND live_name IS NOT NULL), false)
    INTO v_missing_classified_field, v_unclassified_live_field FROM classification_comparison;
  IF v_missing_classified_field THEN
    RAISE EXCEPTION 'audit_payment_credential_classification_invalid'
      USING ERRCODE = '55000';
  END IF;
  IF v_unclassified_live_field THEN
    RAISE EXCEPTION 'audit_payment_credential_unclassified_column'
      USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.id IS DISTINCT FROM NEW.id THEN
    RAISE EXCEPTION 'audit_payment_credential_id_reassignment_forbidden'
      USING ERRCODE = '22023';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.merchant_id IS DISTINCT FROM NEW.merchant_id THEN
    RAISE EXCEPTION 'audit_payment_credential_merchant_reassignment_forbidden'
      USING ERRCODE = '22023';
  END IF;
  IF TG_OP = 'DELETE' THEN
    v_merchant_id := OLD.merchant_id;
    v_credential_id := OLD.id;
    SELECT NULLIF(pg_catalog.btrim(merchant.business_name), '')
      INTO v_merchant_label
    FROM public.merchants AS merchant
    WHERE merchant.id = v_merchant_id;
    v_is_cascade := NOT FOUND;
    v_action := CASE
      WHEN v_is_cascade THEN 'payment_credential.cascade_delete'
      ELSE 'payment_credential.delete'
    END;
  ELSIF TG_OP = 'INSERT' THEN
    v_merchant_id := NEW.merchant_id;
    v_credential_id := NEW.id;
    v_action := 'payment_credential.create';
  ELSE
    v_merchant_id := NEW.merchant_id;
    v_credential_id := NEW.id;
    v_action := 'payment_credential.update';
  END IF;
  IF v_merchant_id IS NULL OR v_credential_id IS NULL THEN
    RAISE EXCEPTION 'audit_payment_credential_identity_required'
      USING ERRCODE = '22023';
  END IF;
  IF TG_OP <> 'DELETE' THEN
    SELECT NULLIF(pg_catalog.btrim(merchant.business_name), '')
      INTO v_merchant_label
    FROM public.merchants AS merchant
    WHERE merchant.id = v_merchant_id;
  END IF;
  IF v_merchant_label IS NOT NULL
    AND pg_catalog.char_length(v_merchant_label) > 160 THEN
    v_merchant_label := NULL;
  END IF;
  IF TG_OP <> 'INSERT' THEN
    v_old_slot := private.audit_payment_credential_slot_v1(OLD.provider, OLD.credential_role, OLD.environment, OLD.kek_version);
    v_old_active_state := private.audit_payment_credential_active_state_v1(OLD.is_active, OLD.disabled_at, OLD.disabled_reason);
    v_old_validation_state := private.audit_payment_credential_validation_state_v1(OLD.last_validated_at, OLD.last_validation_error);
  END IF;
  IF TG_OP <> 'DELETE' THEN
    v_new_slot := private.audit_payment_credential_slot_v1(NEW.provider, NEW.credential_role, NEW.environment, NEW.kek_version);
    v_new_active_state := private.audit_payment_credential_active_state_v1(NEW.is_active, NEW.disabled_at, NEW.disabled_reason);
    v_new_validation_state := private.audit_payment_credential_validation_state_v1(NEW.last_validated_at, NEW.last_validation_error);
  END IF;
  IF TG_OP = 'INSERT' THEN
    v_changed_fields := ARRAY[
      'slot', 'credential_state', 'active_state', 'validation_state'
    ]::text[];
    v_new_credential_state := private.audit_payment_credential_presence_state_v1(false, true);
    v_after_values := pg_catalog.jsonb_build_object(
      'slot', v_new_slot,
      'credential_state', v_new_credential_state,
      'active_state', v_new_active_state,
      'validation_state', v_new_validation_state
    );
  ELSIF TG_OP = 'DELETE' THEN
    v_changed_fields := ARRAY[
      'slot', 'credential_state', 'active_state', 'validation_state'
    ]::text[];
    v_before_values := pg_catalog.jsonb_build_object(
      'slot', v_old_slot,
      'credential_state', v_old_credential_state,
      'active_state', v_old_active_state,
      'validation_state', v_old_validation_state
    );
  ELSE
    IF v_old_slot IS DISTINCT FROM v_new_slot THEN
      v_changed_fields := pg_catalog.array_append(v_changed_fields, 'slot');
      v_before_values := v_before_values || pg_catalog.jsonb_build_object('slot', v_old_slot);
      v_after_values := v_after_values || pg_catalog.jsonb_build_object('slot', v_new_slot);
    END IF;
    v_credential_changed := OLD.ciphertext IS DISTINCT FROM NEW.ciphertext
      OR OLD.key_last4 IS DISTINCT FROM NEW.key_last4;
    IF v_credential_changed THEN
      v_changed_fields := pg_catalog.array_append(v_changed_fields, 'credential_state');
      v_new_credential_state := private.audit_payment_credential_presence_state_v1(true, true);
      v_before_values := v_before_values || pg_catalog.jsonb_build_object(
        'credential_state', v_old_credential_state
      );
      v_after_values := v_after_values || pg_catalog.jsonb_build_object(
        'credential_state', v_new_credential_state
      );
    END IF;
    v_active_changed := OLD.is_active IS DISTINCT FROM NEW.is_active
      OR OLD.disabled_at IS DISTINCT FROM NEW.disabled_at
      OR OLD.disabled_reason IS DISTINCT FROM NEW.disabled_reason;
    IF v_active_changed THEN
      IF OLD.disabled_reason IS DISTINCT FROM NEW.disabled_reason THEN
        v_new_active_state := v_new_active_state || pg_catalog.jsonb_build_object(
          'disabled_reason_change', private.audit_payment_credential_presence_state_v1(
            NULLIF(pg_catalog.btrim(OLD.disabled_reason), '') IS NOT NULL,
            NULLIF(pg_catalog.btrim(NEW.disabled_reason), '') IS NOT NULL
          )
        );
      END IF;
      v_changed_fields := pg_catalog.array_append(v_changed_fields, 'active_state');
      v_before_values := v_before_values || pg_catalog.jsonb_build_object(
        'active_state', v_old_active_state
      );
      v_after_values := v_after_values || pg_catalog.jsonb_build_object(
        'active_state', v_new_active_state
      );
    END IF;
    v_validation_changed := OLD.last_validated_at IS DISTINCT FROM NEW.last_validated_at
      OR OLD.last_validation_error IS DISTINCT FROM NEW.last_validation_error;
    IF v_validation_changed THEN
      IF OLD.last_validated_at IS DISTINCT FROM NEW.last_validated_at THEN
        v_new_validation_state := v_new_validation_state || pg_catalog.jsonb_build_object(
          'validated_at_change', private.audit_payment_credential_presence_state_v1(
            OLD.last_validated_at IS NOT NULL, NEW.last_validated_at IS NOT NULL
          )
        );
      END IF;
      IF OLD.last_validation_error IS DISTINCT FROM NEW.last_validation_error THEN
        v_new_validation_state := v_new_validation_state || pg_catalog.jsonb_build_object(
          'error_change', private.audit_payment_credential_presence_state_v1(
            NULLIF(pg_catalog.btrim(OLD.last_validation_error), '') IS NOT NULL,
            NULLIF(pg_catalog.btrim(NEW.last_validation_error), '') IS NOT NULL
          )
        );
      END IF;
      v_changed_fields := pg_catalog.array_append(v_changed_fields, 'validation_state');
      v_before_values := v_before_values || pg_catalog.jsonb_build_object(
        'validation_state', v_old_validation_state
      );
      v_after_values := v_after_values || pg_catalog.jsonb_build_object(
        'validation_state', v_new_validation_state
      );
    END IF;
  END IF;
  IF pg_catalog.cardinality(v_changed_fields) = 0 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF pg_catalog.octet_length(v_before_values::text) > 16384
    OR pg_catalog.octet_length(v_after_values::text) > 16384 THEN
    RAISE EXCEPTION 'audit_payment_credential_payload_too_large'
      USING ERRCODE = '54000';
  END IF;
  SELECT capability.capability INTO v_writer_capability
  FROM private.audit_event_writer_capabilities AS capability
  WHERE capability.capability_name = 'canonical_audit_event_writer_v1';
  IF v_writer_capability IS NULL THEN
    RAISE EXCEPTION 'audit_payment_credential_writer_capability_unavailable'
      USING ERRCODE = '42501';
  END IF;
  PERFORM private.write_audit_event_v1(
    v_merchant_id, v_merchant_label, v_action, 'merchant_payment_credential'::text,
    v_credential_id::text, v_changed_fields, NULLIF(v_before_values, '{}'::jsonb),
    NULLIF(v_after_values, '{}'::jsonb), NULL::uuid, NULL::uuid, 1::smallint,
    pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'category', 'payment_credential', 'operation', pg_catalog.lower(TG_OP),
      'reason_code', CASE WHEN v_is_cascade THEN 'merchant_cascade' ELSE NULL END
    )), v_writer_capability
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;
ALTER FUNCTION private.audit_payment_credential_change_v1() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.audit_payment_credential_change_v1()
  FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS audit_payment_credential_change_v1
  ON private.merchant_payment_credentials;
CREATE TRIGGER audit_payment_credential_change_v1
  AFTER INSERT OR DELETE OR UPDATE ON private.merchant_payment_credentials
  FOR EACH ROW
  EXECUTE FUNCTION private.audit_payment_credential_change_v1();
-- The existing set/get/disable/delete/pair RPCs remain service-role-only.
REVOKE ALL ON FUNCTION public.set_merchant_payment_credential(uuid, text, text, text, text, smallint, text) FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.set_merchant_payment_credential(uuid, text, text, text, text, smallint, text) TO service_role;
REVOKE ALL ON FUNCTION public.get_merchant_payment_credential_meta(uuid, text) FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.get_merchant_payment_credential_meta(uuid, text) TO service_role;
REVOKE ALL ON FUNCTION public.get_merchant_payment_credential_ciphertext(uuid, text, text, text) FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.get_merchant_payment_credential_ciphertext(uuid, text, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.mark_merchant_payment_credential_invalid(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.mark_merchant_payment_credential_invalid(uuid, text, text, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.delete_merchant_payment_credential(uuid, text) FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.delete_merchant_payment_credential(uuid, text) TO service_role;
REVOKE ALL ON FUNCTION public.delete_merchant_payment_credential_role(uuid, text, text, text) FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.delete_merchant_payment_credential_role(uuid, text, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.replace_merchant_payment_credential_pair(uuid, text, text, text, smallint, text, text, smallint, text) FROM PUBLIC, anon, authenticated; GRANT EXECUTE ON FUNCTION public.replace_merchant_payment_credential_pair(uuid, text, text, text, smallint, text, text, smallint, text) TO service_role;
