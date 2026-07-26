-- Immutable, tenant-owned audit ledger. Snapshot IDs deliberately have no
-- source-table foreign keys so forensic records survive retention/deletion.

CREATE OR REPLACE FUNCTION private.audit_event_metadata_valid_v1(p_metadata jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT jsonb_typeof(COALESCE(p_metadata, '{}'::jsonb)) = 'object'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_object_keys(COALESCE(p_metadata, '{}'::jsonb)) AS key(name)
      WHERE key.name NOT IN ('category', 'operation', 'reason_code', 'result')
    );
$$;

REVOKE ALL ON FUNCTION private.audit_event_metadata_valid_v1(jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public.audit_events (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  database_transaction_id bigint NOT NULL DEFAULT pg_catalog.txid_current(),
  merchant_id uuid NOT NULL,
  merchant_label text,
  actor_user_id uuid,
  actor_type text NOT NULL,
  actor_label text,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  changed_fields text[] NOT NULL DEFAULT ARRAY[]::text[],
  before_values jsonb,
  after_values jsonb,
  source text NOT NULL,
  correlation_id uuid,
  request_id uuid,
  schema_version smallint NOT NULL DEFAULT 1,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT audit_events_actor_type_check CHECK (actor_type IN ('user', 'service', 'system')),
  CONSTRAINT audit_events_source_check CHECK (source IN ('api', 'database', 'migration', 'system')),
  CONSTRAINT audit_events_merchant_label_check CHECK (merchant_label IS NULL OR char_length(merchant_label) BETWEEN 1 AND 160),
  CONSTRAINT audit_events_actor_label_check CHECK (actor_label IS NULL OR char_length(actor_label) BETWEEN 1 AND 160),
  CONSTRAINT audit_events_action_check CHECK (char_length(action) BETWEEN 1 AND 100 AND action ~ '^[a-z0-9][a-z0-9._-]*$'),
  CONSTRAINT audit_events_resource_type_check CHECK (char_length(resource_type) BETWEEN 1 AND 80 AND resource_type ~ '^[a-z0-9][a-z0-9._-]*$'),
  CONSTRAINT audit_events_resource_id_check CHECK (char_length(resource_id) BETWEEN 1 AND 160),
  CONSTRAINT audit_events_changed_fields_check CHECK (COALESCE(array_length(changed_fields, 1), 0) <= 64),
  CONSTRAINT audit_events_before_values_check CHECK (
    before_values IS NULL OR (jsonb_typeof(before_values) = 'object' AND jsonb_object_length(before_values) <= 64 AND octet_length(before_values::text) <= 16384)
  ),
  CONSTRAINT audit_events_after_values_check CHECK (
    after_values IS NULL OR (jsonb_typeof(after_values) = 'object' AND jsonb_object_length(after_values) <= 64 AND octet_length(after_values::text) <= 16384)
  ),
  CONSTRAINT audit_events_schema_version_check CHECK (schema_version BETWEEN 1 AND 9),
  CONSTRAINT audit_events_metadata_check CHECK (
    jsonb_object_length(metadata) <= 16
    AND octet_length(metadata::text) <= 8192
    AND private.audit_event_metadata_valid_v1(metadata)
  )
);

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.audit_events FROM PUBLIC, anon, authenticated, service_role;

CREATE INDEX idx_audit_events_merchant_occurred_id
  ON public.audit_events (merchant_id, occurred_at DESC, id DESC);
CREATE INDEX idx_audit_events_resource_occurred_id
  ON public.audit_events (merchant_id, resource_type, resource_id, occurred_at DESC, id DESC);

CREATE OR REPLACE FUNCTION private.reject_audit_event_mutation_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'audit_events_are_immutable' USING ERRCODE = '55000';
END;
$$;

REVOKE ALL ON FUNCTION private.reject_audit_event_mutation_v1()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER reject_audit_event_mutation_v1
  BEFORE UPDATE OR DELETE ON public.audit_events
  FOR EACH ROW EXECUTE FUNCTION private.reject_audit_event_mutation_v1();

CREATE OR REPLACE FUNCTION private.write_audit_event_v1(
  p_merchant_id uuid,
  p_merchant_label text,
  p_actor_type text,
  p_actor_label text,
  p_action text,
  p_resource_type text,
  p_resource_id text,
  p_changed_fields text[],
  p_before_values jsonb,
  p_after_values jsonb,
  p_source text,
  p_correlation_id uuid,
  p_request_id uuid,
  p_schema_version smallint,
  p_metadata jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_user_id uuid := (SELECT auth.uid());
  v_explicit_actor_setting text := NULLIF(pg_catalog.current_setting('app.audit_actor_user_id', true), '');
  v_explicit_actor_user_id uuid;
  v_id uuid;
BEGIN
  IF pg_catalog.pg_trigger_depth() = 0 THEN
    RAISE EXCEPTION 'audit_writer_requires_trigger' USING ERRCODE = '42501';
  END IF;
  IF v_explicit_actor_setting IS NOT NULL THEN
    v_explicit_actor_user_id := v_explicit_actor_setting::uuid;
  END IF;
  IF v_actor_user_id IS NULL AND v_explicit_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'audit_actor_required' USING ERRCODE = '28000';
  END IF;
  IF v_actor_user_id IS NOT NULL AND v_explicit_actor_user_id IS NOT NULL
     AND v_actor_user_id IS DISTINCT FROM v_explicit_actor_user_id THEN
    RAISE EXCEPTION 'audit_actor_conflict' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.audit_events (
    merchant_id, merchant_label, actor_user_id, actor_type, actor_label,
    action, resource_type, resource_id, changed_fields, before_values,
    after_values, source, correlation_id, request_id, schema_version, metadata
  ) VALUES (
    p_merchant_id, p_merchant_label, COALESCE(v_actor_user_id, v_explicit_actor_user_id),
    p_actor_type, p_actor_label, p_action, p_resource_type, p_resource_id,
    COALESCE(p_changed_fields, ARRAY[]::text[]), p_before_values, p_after_values,
    p_source, p_correlation_id, p_request_id, COALESCE(p_schema_version, 1),
    COALESCE(p_metadata, '{}'::jsonb)
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION private.write_audit_event_v1(
  uuid, text, text, text, text, text, text, text[], jsonb, jsonb, text,
  uuid, uuid, smallint, jsonb
) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.list_merchant_audit_events_v1(
  p_merchant_id uuid,
  p_limit integer,
  p_before_occurred_at timestamptz,
  p_before_id uuid,
  p_resource_type text,
  p_action text
) RETURNS TABLE (
  id uuid,
  occurred_at timestamptz,
  database_transaction_id bigint,
  merchant_id uuid,
  merchant_label text,
  actor_user_id uuid,
  actor_type text,
  actor_label text,
  action text,
  resource_type text,
  resource_id text,
  changed_fields text[],
  before_values jsonb,
  after_values jsonb,
  source text,
  correlation_id uuid,
  request_id uuid,
  schema_version smallint,
  metadata jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_user_id uuid := (SELECT auth.uid());
BEGIN
  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'audit_merchant_id_required' USING ERRCODE = '22023';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 101 THEN
    RAISE EXCEPTION 'audit_limit_invalid' USING ERRCODE = '22023';
  END IF;
  IF (p_before_occurred_at IS NULL) <> (p_before_id IS NULL) THEN
    RAISE EXCEPTION 'audit_cursor_invalid' USING ERRCODE = '22023';
  END IF;
  IF (p_resource_type IS NOT NULL AND (char_length(p_resource_type) NOT BETWEEN 1 AND 80 OR p_resource_type !~ '^[a-z0-9][a-z0-9._-]*$'))
     OR (p_action IS NOT NULL AND (char_length(p_action) NOT BETWEEN 1 AND 100 OR p_action !~ '^[a-z0-9][a-z0-9._-]*$')) THEN
    RAISE EXCEPTION 'audit_filter_invalid' USING ERRCODE = '22023';
  END IF;
  IF v_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.merchants AS merchant
    WHERE merchant.id = p_merchant_id AND merchant.user_id = v_actor_user_id
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    event.id, event.occurred_at, event.database_transaction_id, event.merchant_id,
    event.merchant_label, event.actor_user_id, event.actor_type, event.actor_label,
    event.action, event.resource_type, event.resource_id, event.changed_fields,
    event.before_values, event.after_values, event.source, event.correlation_id,
    event.request_id, event.schema_version,
    pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'category', event.metadata -> 'category',
      'operation', event.metadata -> 'operation',
      'reason_code', event.metadata -> 'reason_code',
      'result', event.metadata -> 'result'
    ))
  FROM public.audit_events AS event
  WHERE event.merchant_id = p_merchant_id
    AND (p_before_occurred_at IS NULL OR (event.occurred_at, event.id) < (p_before_occurred_at, p_before_id))
    AND (p_resource_type IS NULL OR event.resource_type = p_resource_type)
    AND (p_action IS NULL OR event.action = p_action)
  ORDER BY event.occurred_at DESC, event.id DESC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.list_merchant_audit_events_v1(
  uuid, integer, timestamptz, uuid, text, text
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.list_merchant_audit_events_v1(
  uuid, integer, timestamptz, uuid, text, text
) TO authenticated;
