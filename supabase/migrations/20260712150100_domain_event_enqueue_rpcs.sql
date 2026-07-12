-- Durable domain-event enqueue RPCs.

CREATE OR REPLACE FUNCTION eventing.enqueue_domain_event_v1(
  p_producer text,
  p_trust_level text,
  p_idempotency_key text,
  p_external_event_id text,
  p_event_name text,
  p_subject_type text,
  p_subject_id text,
  p_merchant_id uuid,
  p_source jsonb,
  p_data jsonb,
  p_metadata jsonb,
  p_occurred_at timestamptz DEFAULT now(),
  p_changed_fields text[] DEFAULT NULL,
  p_correlation_id text DEFAULT NULL,
  p_causation_id uuid DEFAULT NULL
) RETURNS TABLE (
  domain_event_id uuid,
  queue_message_id bigint,
  already_enqueued boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET statement_timeout = '5s'
AS $$
DECLARE
  v_domain_event_id uuid;
  v_queue_message_id bigint;
  v_updated_count integer;
  v_envelope jsonb;
BEGIN
  IF p_idempotency_key IS NULL OR length(p_idempotency_key) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'invalid_domain_event_idempotency_key'
      USING ERRCODE = '22023';
  END IF;
  IF p_producer NOT IN ('database', 'web', 'mobile', 'worker') THEN
    RAISE EXCEPTION 'invalid_domain_event_producer'
      USING ERRCODE = '22023';
  END IF;
  IF p_trust_level NOT IN (
    'anonymous_client',
    'authenticated_client',
    'tenant_verified_client',
    'server',
    'database'
  ) THEN
    RAISE EXCEPTION 'invalid_domain_event_trust_level'
      USING ERRCODE = '22023';
  END IF;
  IF p_occurred_at IS NULL
    OR p_occurred_at > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'domain_event_timestamp_in_future'
      USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(COALESCE(p_source, '{}'::jsonb)) <> 'object'
    OR jsonb_typeof(COALESCE(p_data, '{}'::jsonb)) <> 'object'
    OR jsonb_typeof(COALESCE(p_metadata, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'domain_event_json_objects_required'
      USING ERRCODE = '22023';
  END IF;
  IF COALESCE(p_source, '{}'::jsonb) - ARRAY['schema', 'table', 'operation']
      <> '{}'::jsonb
    OR (
      COALESCE(p_source, '{}'::jsonb) ? 'operation'
      AND COALESCE(p_source->>'operation', '')
        NOT IN ('INSERT', 'UPDATE', 'DELETE')
    )
    OR (
      COALESCE(p_source, '{}'::jsonb) ? 'schema'
      AND (
        jsonb_typeof(p_source->'schema') <> 'string'
        OR length(p_source->>'schema') NOT BETWEEN 1 AND 63
      )
    )
    OR (
      COALESCE(p_source, '{}'::jsonb) ? 'table'
      AND (
        jsonb_typeof(p_source->'table') <> 'string'
        OR length(p_source->>'table') NOT BETWEEN 1 AND 63
      )
    ) THEN
    RAISE EXCEPTION 'invalid_domain_event_source'
      USING ERRCODE = '22023';
  END IF;
  IF COALESCE(p_metadata, '{}'::jsonb)
      - ARRAY['environment', 'request_id', 'shadow_only'] <> '{}'::jsonb
    OR (
      COALESCE(p_metadata, '{}'::jsonb) ? 'request_id'
      AND (
        jsonb_typeof(p_metadata->'request_id') <> 'string'
        OR length(p_metadata->>'request_id') NOT BETWEEN 1 AND 200
        OR p_metadata->>'request_id' !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$'
      )
    )
    OR (
      COALESCE(p_metadata, '{}'::jsonb) ? 'shadow_only'
      AND jsonb_typeof(p_metadata->'shadow_only') <> 'boolean'
    ) THEN
    RAISE EXCEPTION 'invalid_domain_event_metadata'
      USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(COALESCE(p_metadata, '{}'::jsonb)->'environment') <> 'string'
    OR length(COALESCE(p_metadata->>'environment', '')) NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'domain_event_environment_required'
      USING ERRCODE = '22023';
  END IF;
  IF cardinality(COALESCE(p_changed_fields, ARRAY[]::text[])) > 100
    OR EXISTS (
      SELECT 1 FROM unnest(COALESCE(p_changed_fields, ARRAY[]::text[])) AS field
      WHERE field IS NULL OR length(field) NOT BETWEEN 1 AND 100
    )
    OR (
      p_correlation_id IS NOT NULL
      AND length(p_correlation_id) NOT BETWEEN 1 AND 200
    ) THEN
    RAISE EXCEPTION 'invalid_domain_event_optional_fields'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.domain_event_ledger (
    producer,
    trust_level,
    idempotency_key,
    external_event_id,
    event_name,
    schema_version,
    subject_type,
    subject_id,
    merchant_id,
    envelope,
    status,
    created_at
  ) VALUES (
    p_producer,
    p_trust_level,
    p_idempotency_key,
    NULLIF(p_external_event_id, ''),
    p_event_name,
    1,
    p_subject_type,
    p_subject_id,
    p_merchant_id,
    '{}'::jsonb,
    'queued',
    now()
  )
  ON CONFLICT (producer, idempotency_key) DO NOTHING
  RETURNING domain_event_ledger.domain_event_id
    INTO v_domain_event_id;

  IF v_domain_event_id IS NULL THEN
    SELECT duplicate.domain_event_id, duplicate.queue_message_id
    INTO v_domain_event_id, v_queue_message_id
    FROM eventing.resolve_domain_event_duplicate_v1(
      p_producer, p_trust_level, p_idempotency_key, p_external_event_id,
      p_event_name, p_subject_type, p_subject_id, p_merchant_id, p_data
    ) AS duplicate;

    RETURN QUERY
    SELECT v_domain_event_id, v_queue_message_id, true;
    RETURN;
  END IF;

  v_envelope := jsonb_strip_nulls(jsonb_build_object(
    'schema_version', 1,
    'domain_event_id', v_domain_event_id,
    'external_event_id', NULLIF(p_external_event_id, ''),
    'event_name', p_event_name,
    'occurred_at', p_occurred_at,
    'producer', p_producer,
    'trust_level', p_trust_level,
    'source', COALESCE(p_source, '{}'::jsonb),
    'subject', jsonb_build_object(
      'type', p_subject_type,
      'id', p_subject_id
    ),
    'merchant_id', p_merchant_id,
    'correlation_id', NULLIF(p_correlation_id, ''),
    'causation_id', p_causation_id,
    'idempotency_key', p_idempotency_key,
    'changed_fields', to_jsonb(p_changed_fields),
    'data', COALESCE(p_data, '{}'::jsonb),
    'metadata', COALESCE(p_metadata, '{}'::jsonb)
  ));

  IF octet_length(v_envelope::text) > 65536 THEN
    RAISE EXCEPTION 'domain_event_envelope_too_large'
      USING ERRCODE = '22001';
  END IF;

  SELECT sent.msg_id
  INTO v_queue_message_id
  FROM pgmq.send('domain_events', v_envelope) AS sent(msg_id);

  IF v_queue_message_id IS NULL THEN
    RAISE EXCEPTION 'domain_event_queue_send_failed';
  END IF;

  UPDATE public.domain_event_ledger AS ledger
  SET
    envelope = v_envelope,
    queue_message_id = v_queue_message_id
  WHERE ledger.domain_event_id = v_domain_event_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count <> 1 THEN
    RAISE EXCEPTION 'domain_event_ledger_update_failed';
  END IF;

  RETURN QUERY
  SELECT v_domain_event_id, v_queue_message_id, false;
END;
$$;

REVOKE ALL ON FUNCTION eventing.enqueue_domain_event_v1(
  text, text, text, text, text, text, text, uuid, jsonb, jsonb, jsonb,
  timestamptz, text[], text, uuid
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.enqueue_domain_event_v1(
  p_producer text,
  p_trust_level text,
  p_idempotency_key text,
  p_external_event_id text,
  p_event_name text,
  p_subject_type text,
  p_subject_id text,
  p_merchant_id uuid,
  p_source jsonb,
  p_data jsonb,
  p_metadata jsonb,
  p_occurred_at timestamptz DEFAULT now(),
  p_changed_fields text[] DEFAULT NULL,
  p_correlation_id text DEFAULT NULL,
  p_causation_id uuid DEFAULT NULL
) RETURNS TABLE (
  domain_event_id uuid,
  queue_message_id bigint,
  already_enqueued boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET statement_timeout = '5s'
AS $$
BEGIN
  IF COALESCE((SELECT auth.role()), '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden: enqueue_domain_event_v1 requires service_role'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT *
  FROM eventing.enqueue_domain_event_v1(
    p_producer,
    p_trust_level,
    p_idempotency_key,
    p_external_event_id,
    p_event_name,
    p_subject_type,
    p_subject_id,
    p_merchant_id,
    p_source,
    p_data,
    p_metadata,
    p_occurred_at,
    p_changed_fields,
    p_correlation_id,
    p_causation_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_domain_event_v1(
  text, text, text, text, text, text, text, uuid, jsonb, jsonb, jsonb,
  timestamptz, text[], text, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_domain_event_v1(
  text, text, text, text, text, text, text, uuid, jsonb, jsonb, jsonb,
  timestamptz, text[], text, uuid
) TO service_role;
