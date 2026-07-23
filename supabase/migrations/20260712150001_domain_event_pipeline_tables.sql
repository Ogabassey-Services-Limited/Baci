-- Durable domain-event pipeline: logged PGMQ ingress plus service-only ledgers.
-- Production capability verified read-only on 2026-07-12:
-- PostgreSQL 17.6, pgmq 1.5.1 available (not installed), pg_net 0.19.5.

CREATE EXTENSION IF NOT EXISTS pgmq;

SELECT pgmq.create('domain_events');

REVOKE ALL ON SCHEMA pgmq FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA pgmq
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.domain_event_producer_config (
  producer_key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  shadow_only boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT domain_event_producer_key_length
    CHECK (length(producer_key) BETWEEN 3 AND 100)
);

CREATE TABLE IF NOT EXISTS public.domain_event_ledger (
  domain_event_id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  producer text NOT NULL,
  trust_level text NOT NULL,
  idempotency_key text NOT NULL,
  external_event_id text,
  event_name text NOT NULL,
  schema_version integer NOT NULL DEFAULT 1,
  subject_type text NOT NULL,
  subject_id text NOT NULL,
  merchant_id uuid,
  envelope jsonb NOT NULL,
  queue_message_id bigint,
  status text NOT NULL DEFAULT 'queued',
  created_at timestamptz NOT NULL DEFAULT now(),
  routed_at timestamptz,
  CONSTRAINT domain_event_ledger_producer_idempotency_key
    UNIQUE (producer, idempotency_key),
  CONSTRAINT domain_event_ledger_trust_level_check
    CHECK (trust_level IN (
      'anonymous_client',
      'authenticated_client',
      'tenant_verified_client',
      'server',
      'database'
    )),
  CONSTRAINT domain_event_ledger_status_check
    CHECK (status IN ('queued', 'routed', 'no_route', 'ingress_dead_letter')),
  CONSTRAINT domain_event_ledger_schema_version_check
    CHECK (schema_version = 1),
  CONSTRAINT domain_event_ledger_event_name_check
    CHECK (
      length(event_name) BETWEEN 3 AND 150
      AND event_name ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+\.v1$'
    ),
  CONSTRAINT domain_event_ledger_text_lengths_check
    CHECK (
      length(producer) BETWEEN 1 AND 100
      AND length(idempotency_key) BETWEEN 1 AND 500
      AND length(subject_type) BETWEEN 1 AND 100
      AND length(subject_id) BETWEEN 1 AND 500
      AND (external_event_id IS NULL OR length(external_event_id) <= 500)
    ),
  CONSTRAINT domain_event_ledger_envelope_size_check
    CHECK (octet_length(envelope::text) <= 65536)
);

CREATE TABLE IF NOT EXISTS public.domain_event_failures (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  domain_event_id uuid REFERENCES public.domain_event_ledger(domain_event_id)
    ON DELETE RESTRICT,
  queue_message_id bigint NOT NULL,
  original_envelope jsonb NOT NULL,
  failure_code text NOT NULL,
  failure_message text NOT NULL,
  parser_version integer,
  event_name text,
  merchant_id uuid,
  first_failed_at timestamptz NOT NULL DEFAULT now(),
  last_failed_at timestamptz NOT NULL DEFAULT now(),
  replay_count integer NOT NULL DEFAULT 0,
  replayed_by uuid,
  replayed_at timestamptz,
  replay_reason text,
  CONSTRAINT domain_event_failures_queue_message_id UNIQUE (queue_message_id),
  CONSTRAINT domain_event_failures_replay_count_check CHECK (replay_count >= 0),
  CONSTRAINT domain_event_failures_text_check CHECK (
    length(failure_code) BETWEEN 1 AND 100
    AND length(failure_message) BETWEEN 1 AND 2000
    AND (replay_reason IS NULL OR length(replay_reason) <= 1000)
  ),
  CONSTRAINT domain_event_failures_envelope_size_check
    CHECK (octet_length(original_envelope::text) <= 65536)
);

CREATE TABLE IF NOT EXISTS public.event_deliveries (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  domain_event_id uuid NOT NULL
    REFERENCES public.domain_event_ledger(domain_event_id) ON DELETE RESTRICT,
  destination text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  replay_count integer NOT NULL DEFAULT 0,
  last_replayed_by uuid,
  last_replayed_at timestamptz,
  last_replay_reason text,
  available_at timestamptz NOT NULL DEFAULT now(),
  claim_token uuid,
  claimed_at timestamptz,
  claimed_by text,
  last_error_code text,
  last_error_message text,
  last_http_status integer,
  provider_response_id text,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  shadowed_at timestamptz,
  skipped_at timestamptz,
  delivered_at timestamptz,
  dead_lettered_at timestamptz,
  CONSTRAINT event_deliveries_event_destination_key
    UNIQUE (domain_event_id, destination),
  CONSTRAINT event_deliveries_status_check CHECK (status IN (
    'pending',
    'claimed',
    'retry',
    'shadowed',
    'skipped',
    'delivery_unknown',
    'delivered',
    'dead_letter'
  )),
  CONSTRAINT event_deliveries_attempts_check CHECK (attempts >= 0),
  CONSTRAINT event_deliveries_replay_count_check CHECK (replay_count >= 0),
  CONSTRAINT event_deliveries_claim_check CHECK (
    (
      status = 'claimed'
      AND claim_token IS NOT NULL
      AND claimed_at IS NOT NULL
      AND claimed_by IS NOT NULL
    ) OR (
      status <> 'claimed'
      AND claim_token IS NULL
      AND claimed_at IS NULL
      AND claimed_by IS NULL
    )
  ),
  CONSTRAINT event_deliveries_destination_check CHECK (
    destination IN ('facebook', 'tiktok', 'snapchat', 'ga4')
  ),
  CONSTRAINT event_deliveries_payload_size_check
    CHECK (octet_length(payload::text) <= 65536),
  CONSTRAINT event_deliveries_error_check CHECK (
    (last_error_code IS NULL OR length(last_error_code) <= 100)
    AND (last_error_message IS NULL OR length(last_error_message) <= 2000)
    AND (last_http_status IS NULL OR last_http_status BETWEEN 100 AND 599)
    AND (provider_response_id IS NULL OR length(provider_response_id) <= 500)
  ),
  CONSTRAINT event_deliveries_replay_reason_check
    CHECK (last_replay_reason IS NULL OR length(last_replay_reason) <= 1000)
);

CREATE TABLE IF NOT EXISTS public.event_delivery_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  delivery_id uuid NOT NULL
    REFERENCES public.event_deliveries(id) ON DELETE RESTRICT,
  attempt_number integer NOT NULL,
  outcome text NOT NULL,
  started_at timestamptz NOT NULL,
  finished_at timestamptz NOT NULL DEFAULT now(),
  duration_ms integer NOT NULL,
  http_status integer,
  error_code text,
  error_message text,
  worker_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_delivery_attempts_delivery_number_key
    UNIQUE (delivery_id, attempt_number),
  CONSTRAINT event_delivery_attempts_number_check CHECK (attempt_number > 0),
  CONSTRAINT event_delivery_attempts_duration_check CHECK (duration_ms >= 0),
  CONSTRAINT event_delivery_attempts_outcome_check CHECK (
    outcome IN ('delivered', 'skipped', 'retry', 'delivery_unknown', 'dead_letter')
  ),
  CONSTRAINT event_delivery_attempts_error_message_check CHECK (
    error_message IS NULL OR length(error_message) <= 2000
  ),
  CONSTRAINT event_delivery_attempts_http_status_check
    CHECK (http_status IS NULL OR http_status BETWEEN 100 AND 599)
);

ALTER TABLE public.platform_events
  ADD COLUMN IF NOT EXISTS event_id text;

CREATE UNIQUE INDEX IF NOT EXISTS platform_events_type_event_id_uidx
  ON public.platform_events (event_type, event_id)
  WHERE event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS domain_event_ledger_created_idx
  ON public.domain_event_ledger (created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS domain_event_ledger_queue_message_id_uidx
  ON public.domain_event_ledger (queue_message_id)
  WHERE queue_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS domain_event_ledger_merchant_created_idx
  ON public.domain_event_ledger (merchant_id, created_at DESC)
  WHERE merchant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS domain_event_failures_code_created_idx
  ON public.domain_event_failures (failure_code, first_failed_at DESC);
CREATE INDEX IF NOT EXISTS domain_event_failures_created_idx
  ON public.domain_event_failures (first_failed_at DESC);
CREATE INDEX IF NOT EXISTS domain_event_failures_domain_event_id_idx
  ON public.domain_event_failures (domain_event_id);
CREATE INDEX IF NOT EXISTS domain_event_failures_merchant_created_idx
  ON public.domain_event_failures (merchant_id, first_failed_at DESC)
  WHERE merchant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS event_deliveries_open_idx
  ON public.event_deliveries (available_at, created_at)
  WHERE status IN ('pending', 'retry');
CREATE INDEX IF NOT EXISTS event_deliveries_claimed_idx
  ON public.event_deliveries (claimed_at)
  WHERE status = 'claimed';
CREATE INDEX IF NOT EXISTS event_deliveries_destination_created_idx
  ON public.event_deliveries (destination, created_at DESC);
CREATE INDEX IF NOT EXISTS event_deliveries_dead_letter_idx
  ON public.event_deliveries (dead_lettered_at DESC)
  WHERE status = 'dead_letter';
CREATE INDEX IF NOT EXISTS event_deliveries_failure_updated_idx
  ON public.event_deliveries (status, updated_at DESC)
  WHERE status IN ('dead_letter', 'delivery_unknown');
CREATE INDEX IF NOT EXISTS event_deliveries_failure_destination_updated_idx
  ON public.event_deliveries (status, destination, updated_at DESC)
  WHERE status IN ('dead_letter', 'delivery_unknown');
CREATE INDEX IF NOT EXISTS event_delivery_attempts_delivery_idx
  ON public.event_delivery_attempts (delivery_id, created_at DESC);

INSERT INTO public.domain_event_producer_config (producer_key, enabled, shadow_only)
VALUES
  ('catalog.products', false, true),
  ('commerce.orders', false, true),
  ('payments.transactions', false, true)
ON CONFLICT (producer_key) DO NOTHING;

ALTER TABLE public.domain_event_producer_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_event_producer_config FORCE ROW LEVEL SECURITY;
ALTER TABLE public.domain_event_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_event_ledger FORCE ROW LEVEL SECURITY;
ALTER TABLE public.domain_event_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_event_failures FORCE ROW LEVEL SECURITY;
ALTER TABLE public.event_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_deliveries FORCE ROW LEVEL SECURITY;
ALTER TABLE public.event_delivery_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_delivery_attempts FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.domain_event_producer_config FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.domain_event_ledger FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.domain_event_failures FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.event_deliveries FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.event_delivery_attempts FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.domain_event_producer_config TO service_role;
GRANT SELECT ON TABLE public.domain_event_ledger TO service_role;
GRANT SELECT ON TABLE public.domain_event_failures TO service_role;
GRANT SELECT ON TABLE public.event_deliveries TO service_role;
GRANT SELECT ON TABLE public.event_delivery_attempts TO service_role;

DROP POLICY IF EXISTS domain_event_producer_config_service_all
  ON public.domain_event_producer_config;
CREATE POLICY domain_event_producer_config_service_all
  ON public.domain_event_producer_config FOR ALL TO postgres, service_role
  USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS domain_event_ledger_service_all
  ON public.domain_event_ledger;
CREATE POLICY domain_event_ledger_service_all
  ON public.domain_event_ledger FOR ALL TO postgres, service_role
  USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS domain_event_failures_service_all
  ON public.domain_event_failures;
CREATE POLICY domain_event_failures_service_all
  ON public.domain_event_failures FOR ALL TO postgres, service_role
  USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS event_deliveries_service_all
  ON public.event_deliveries;
CREATE POLICY event_deliveries_service_all
  ON public.event_deliveries FOR ALL TO postgres, service_role
  USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS event_delivery_attempts_service_all
  ON public.event_delivery_attempts;
CREATE POLICY event_delivery_attempts_service_all
  ON public.event_delivery_attempts FOR ALL TO postgres, service_role
  USING (true) WITH CHECK (true);

COMMENT ON TABLE public.domain_event_ledger IS
  'Canonical durable domain-event identity and producer-deduplication ledger.';
COMMENT ON TABLE public.domain_event_failures IS
  'Service-only immutable ingress failure evidence with audited replay metadata.';
COMMENT ON TABLE public.event_deliveries IS
  'Independent per-destination delivery state for durable domain events.';
