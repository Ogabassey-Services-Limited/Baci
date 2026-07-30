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

CREATE OR REPLACE FUNCTION private.audit_event_changed_fields_valid_v1(p_fields text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT
    COALESCE(array_length(p_fields, 1), 0) <= 64
    AND COALESCE(octet_length(array_to_string(p_fields, ',')), 0) <= 4096
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(COALESCE(p_fields, ARRAY[]::text[])) AS field_name(name)
      WHERE field_name.name IS NULL
        OR char_length(field_name.name) NOT BETWEEN 1 AND 64
        OR field_name.name !~ '^[a-z0-9][a-z0-9._-]*$'
    );
$$;

REVOKE ALL ON FUNCTION private.audit_event_changed_fields_valid_v1(text[])
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.audit_event_json_object_valid_v1(
  p_value jsonb,
  p_max_keys integer,
  p_max_bytes integer
) RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT
    p_value IS NOT NULL
    AND jsonb_typeof(p_value) = 'object'
    AND (SELECT count(*) FROM jsonb_object_keys(p_value)) <= p_max_keys
    AND octet_length(p_value::text) <= p_max_bytes;
$$;

REVOKE ALL ON FUNCTION private.audit_event_json_object_valid_v1(jsonb, integer, integer)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public.audit_events (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  database_transaction_id text NOT NULL,
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
  CONSTRAINT audit_events_changed_fields_check CHECK (private.audit_event_changed_fields_valid_v1(changed_fields)),
  CONSTRAINT audit_events_before_values_check CHECK (
    before_values IS NULL OR private.audit_event_json_object_valid_v1(before_values, 64, 16384)
  ),
  CONSTRAINT audit_events_after_values_check CHECK (
    after_values IS NULL OR private.audit_event_json_object_valid_v1(after_values, 64, 16384)
  ),
  CONSTRAINT audit_events_schema_version_check CHECK (schema_version BETWEEN 1 AND 9),
  CONSTRAINT audit_events_metadata_check CHECK (
    private.audit_event_json_object_valid_v1(metadata, 16, 8192)
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

-- This opaque capability is generated once by the database and is neither
-- callable nor readable by application roles. Later reviewed SECURITY DEFINER
-- trigger wrappers run in the database-owner TCB and may read and pass it to
-- the writer; arbitrary non-owner triggers cannot mint or obtain it.
CREATE TABLE private.audit_event_writer_capabilities (
  capability uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  capability_name text NOT NULL UNIQUE,
  CONSTRAINT audit_event_writer_capabilities_name_check CHECK (
    capability_name = 'canonical_audit_event_writer_v1'
  )
);

ALTER TABLE private.audit_event_writer_capabilities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.audit_event_writer_capabilities
  FROM PUBLIC, anon, authenticated, service_role;

INSERT INTO private.audit_event_writer_capabilities (capability_name)
VALUES ('canonical_audit_event_writer_v1');

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
  v_jwt jsonb := COALESCE(auth.jwt(), '{}'::jsonb);
  v_jwt_role text;
  v_actor_user_id uuid := (SELECT auth.uid());
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
  IF v_explicit_actor_setting IS NOT NULL THEN
    v_explicit_actor_user_id := v_explicit_actor_setting::uuid;
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

REVOKE ALL ON FUNCTION private.write_audit_event_v1(
  uuid, text, text, text, text, text[], jsonb, jsonb, uuid, uuid, smallint, jsonb, uuid
) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.list_merchant_audit_events_v1(
  p_merchant_id uuid,
  p_limit integer,
  p_before_occurred_at timestamptz DEFAULT NULL,
  p_before_id uuid DEFAULT NULL,
  p_resource_type text DEFAULT NULL,
  p_action text DEFAULT NULL
) RETURNS TABLE (
  id uuid,
  occurred_at timestamptz,
  database_transaction_id text,
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
