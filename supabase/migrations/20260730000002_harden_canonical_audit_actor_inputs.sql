-- Normalize session-derived actor values so audited mutations fail closed with
-- stable domain errors rather than parser errors from auth helper functions.

CREATE OR REPLACE FUNCTION private.write_audit_event_v1(
  p_merchant_id uuid,
  p_merchant_label text,
  p_action text,
  p_resource_type text,
  p_resource_id text,
  p_changed_fields text[],
  p_before_values jsonb,
  p_after_values jsonb,
  p_correlation_id uuid,
  p_request_id uuid,
  p_schema_version smallint,
  p_metadata jsonb,
  p_writer_capability uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_jwt jsonb;
  v_jwt_role text;
  v_actor_user_id uuid;
  v_explicit_actor_setting text := NULLIF(pg_catalog.current_setting('app.audit_actor_user_id', true), '');
  v_explicit_actor_user_id uuid;
  v_actor_type text;
  v_actor_label text;
  v_source text;
  v_id uuid;
BEGIN
  IF pg_catalog.pg_trigger_depth() = 0 THEN
    RAISE EXCEPTION 'audit_writer_requires_trigger' USING ERRCODE = '42501';
  END IF;
  IF p_writer_capability IS NULL OR NOT EXISTS (
    SELECT 1
    FROM private.audit_event_writer_capabilities AS capability
    WHERE capability.capability = p_writer_capability
      AND capability.capability_name = 'canonical_audit_event_writer_v1'
  ) THEN
    RAISE EXCEPTION 'audit_writer_capability_required' USING ERRCODE = '42501';
  END IF;
  BEGIN
    v_jwt := COALESCE(auth.jwt(), '{}'::jsonb);
    v_actor_user_id := (SELECT auth.uid());
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'audit_actor_claims_invalid' USING ERRCODE = '22023';
  END;
  IF v_explicit_actor_setting IS NOT NULL THEN
    BEGIN
      v_explicit_actor_user_id := v_explicit_actor_setting::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'audit_actor_setting_invalid' USING ERRCODE = '22023';
    END;
  END IF;
  v_jwt_role := NULLIF(v_jwt ->> 'role', '');
  IF v_jwt_role IS NULL THEN
    v_jwt_role := NULLIF(pg_catalog.current_setting('request.jwt.claim.role', true), '');
  END IF;

  IF v_jwt_role = 'service_role' THEN
    v_actor_user_id := NULL;
    v_actor_type := 'service';
    v_actor_label := 'service_role';
    v_source := 'api';
  ELSIF v_actor_user_id IS NOT NULL THEN
    v_actor_type := 'user';
    v_actor_label := 'authenticated_user';
    v_source := 'api';
  ELSIF v_explicit_actor_user_id IS NOT NULL THEN
    v_actor_user_id := v_explicit_actor_user_id;
    v_actor_type := 'user';
    v_actor_label := 'database_principal';
    v_source := 'database';
  ELSE
    RAISE EXCEPTION 'audit_actor_required' USING ERRCODE = '28000';
  END IF;
  IF v_jwt_role IS DISTINCT FROM 'service_role'
     AND v_actor_user_id IS NOT NULL AND v_explicit_actor_user_id IS NOT NULL
     AND v_actor_user_id IS DISTINCT FROM v_explicit_actor_user_id THEN
    RAISE EXCEPTION 'audit_actor_conflict' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.audit_events (
    id, occurred_at, database_transaction_id, merchant_id, merchant_label, actor_user_id, actor_type, actor_label,
    action, resource_type, resource_id, changed_fields, before_values,
    after_values, source, correlation_id, request_id, schema_version, metadata
  ) VALUES (
    extensions.gen_random_uuid(), pg_catalog.clock_timestamp(), pg_catalog.pg_current_xact_id()::text,
    p_merchant_id, p_merchant_label, v_actor_user_id,
    v_actor_type, v_actor_label, p_action, p_resource_type, p_resource_id,
    COALESCE(p_changed_fields, ARRAY[]::text[]), p_before_values, p_after_values,
    v_source, p_correlation_id, p_request_id, COALESCE(p_schema_version, 1),
    COALESCE(p_metadata, '{}'::jsonb)
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
