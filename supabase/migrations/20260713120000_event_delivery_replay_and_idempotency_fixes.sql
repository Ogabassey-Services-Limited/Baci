-- A replay represents a new operator-approved delivery budget. Volatile
-- provider match context is retained for first delivery but excluded from
-- idempotency equivalence on retried ingress.

CREATE OR REPLACE FUNCTION public.replay_event_delivery_v1(
  p_delivery_id uuid,
  p_replayed_by uuid,
  p_replay_reason text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET statement_timeout = '5s'
AS $$
DECLARE
  v_updated_id uuid;
  v_replay_count integer;
BEGIN
  IF NOT eventing.is_event_pipeline_operator_v1() THEN
    RAISE EXCEPTION 'forbidden: event pipeline operator required'
      USING ERRCODE = '42501';
  END IF;
  IF COALESCE((SELECT auth.role()), '') <> 'service_role'
    AND p_replayed_by IS DISTINCT FROM (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'replay_actor_mismatch' USING ERRCODE = '42501';
  END IF;
  IF length(COALESCE(p_replay_reason, '')) NOT BETWEEN 3 AND 1000 THEN
    RAISE EXCEPTION 'replay_reason_required' USING ERRCODE = '22023';
  END IF;
  IF p_replayed_by IS NULL THEN
    RAISE EXCEPTION 'replay_actor_required' USING ERRCODE = '22023';
  END IF;

  UPDATE public.event_deliveries AS delivery
  SET
    status = 'retry',
    available_at = now(),
    claim_token = NULL,
    claimed_at = NULL,
    claimed_by = NULL,
    attempts = 0,
    replay_count = delivery.replay_count + 1,
    last_replayed_by = p_replayed_by,
    last_replayed_at = now(),
    last_replay_reason = p_replay_reason,
    dead_lettered_at = NULL,
    updated_at = now()
  WHERE delivery.id = p_delivery_id
    AND delivery.status IN ('dead_letter', 'delivery_unknown')
  RETURNING delivery.id, delivery.replay_count
    INTO v_updated_id, v_replay_count;

  IF v_updated_id IS NOT NULL THEN
    INSERT INTO public.event_delivery_replays (
      delivery_id,
      replay_number,
      replayed_by,
      replay_reason
    ) VALUES (
      v_updated_id,
      v_replay_count,
      p_replayed_by,
      p_replay_reason
    );
  END IF;

  RETURN v_updated_id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.replay_event_delivery_v1(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replay_event_delivery_v1(uuid, uuid, text)
  TO authenticated, service_role;

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
    OR (v_ledger.envelope->'data' - 'delivery_user_data') IS DISTINCT FROM
      (COALESCE(p_data, '{}'::jsonb) - 'delivery_user_data')
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
