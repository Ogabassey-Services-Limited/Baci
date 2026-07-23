-- Reject semantic conflicts hidden behind a reused producer idempotency key.

CREATE OR REPLACE FUNCTION eventing.resolve_domain_event_duplicate_v1(
  p_producer text,
  p_trust_level text,
  p_idempotency_key text,
  p_external_event_id text,
  p_event_name text,
  p_subject_type text,
  p_subject_id text,
  p_merchant_id uuid,
  p_data jsonb
) RETURNS TABLE (
  domain_event_id uuid,
  queue_message_id bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET statement_timeout = '2s'
AS $$
DECLARE
  v_ledger public.domain_event_ledger%ROWTYPE;
BEGIN
  SELECT * INTO v_ledger
  FROM public.domain_event_ledger AS ledger
  WHERE ledger.producer = p_producer
    AND ledger.idempotency_key = p_idempotency_key;

  IF NOT FOUND OR v_ledger.queue_message_id IS NULL THEN
    RAISE EXCEPTION 'domain_event_deduplication_row_incomplete'
      USING ERRCODE = '40001';
  END IF;

  IF v_ledger.trust_level IS DISTINCT FROM p_trust_level
    OR v_ledger.external_event_id IS DISTINCT FROM NULLIF(p_external_event_id, '')
    OR v_ledger.event_name IS DISTINCT FROM p_event_name
    OR v_ledger.subject_type IS DISTINCT FROM p_subject_type
    OR v_ledger.subject_id IS DISTINCT FROM p_subject_id
    OR v_ledger.merchant_id IS DISTINCT FROM p_merchant_id
    OR v_ledger.envelope->'data' IS DISTINCT FROM COALESCE(p_data, '{}'::jsonb)
  THEN
    RAISE EXCEPTION 'domain_event_idempotency_conflict'
      USING ERRCODE = '22000';
  END IF;

  RETURN QUERY SELECT v_ledger.domain_event_id, v_ledger.queue_message_id;
END;
$$;

REVOKE ALL ON FUNCTION eventing.resolve_domain_event_duplicate_v1(
  text, text, text, text, text, text, text, uuid, jsonb
) FROM PUBLIC, anon, authenticated, service_role;
