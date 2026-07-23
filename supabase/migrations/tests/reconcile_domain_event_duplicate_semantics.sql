-- Regression proof for domain-event idempotency semantics.
--
-- Delivery-only match context is volatile and must not turn an otherwise
-- equivalent retry into an idempotency conflict. Real event-data drift must
-- still fail closed.

BEGIN;

DO $$
DECLARE
  v_domain_event_id uuid := '00000000-0000-4000-8000-00000000d201';
  v_deduplicated record;
  v_queue_message_id bigint := 9201201;
BEGIN
  INSERT INTO public.domain_event_ledger (
    domain_event_id,
    producer,
    trust_level,
    idempotency_key,
    external_event_id,
    event_name,
    subject_type,
    subject_id,
    merchant_id,
    envelope,
    queue_message_id
  )
  VALUES (
    v_domain_event_id,
    'sql-reconciliation',
    'server',
    'duplicate-semantics-1',
    'duplicate-semantics-external-1',
    'commerce.order.created.v1',
    'order',
    'duplicate-semantics-order-1',
    NULL,
    jsonb_build_object(
      'data',
      jsonb_build_object(
        'event_type',
        'purchase',
        'event_data',
        jsonb_build_object('value', 100),
        'delivery_user_data',
        jsonb_build_object('campaign', 'original')
      )
    ),
    v_queue_message_id
  );

  SELECT *
  INTO v_deduplicated
  FROM eventing.resolve_domain_event_duplicate_v1(
    'sql-reconciliation',
    'server',
    'duplicate-semantics-1',
    'duplicate-semantics-external-1',
    'commerce.order.created.v1',
    'order',
    'duplicate-semantics-order-1',
    NULL,
    jsonb_build_object(
      'event_type',
      'purchase',
      'event_data',
      jsonb_build_object('value', 100),
      'delivery_user_data',
      jsonb_build_object('campaign', 'retry')
    )
  );

  IF v_deduplicated.domain_event_id IS DISTINCT FROM v_domain_event_id
    OR v_deduplicated.queue_message_id IS DISTINCT FROM v_queue_message_id
  THEN
    RAISE EXCEPTION
      'delivery-only duplicate did not resolve to the original domain event';
  END IF;

  BEGIN
    PERFORM *
    FROM eventing.resolve_domain_event_duplicate_v1(
      'sql-reconciliation',
      'server',
      'duplicate-semantics-1',
      'duplicate-semantics-external-1',
      'commerce.order.created.v1',
      'order',
      'duplicate-semantics-order-1',
      NULL,
      jsonb_build_object(
        'event_type',
        'purchase',
        'event_data',
        jsonb_build_object('value', 101),
        'delivery_user_data',
        jsonb_build_object('campaign', 'retry')
      )
    );

    RAISE EXCEPTION 'semantic domain-event drift unexpectedly deduplicated';
  EXCEPTION
    WHEN SQLSTATE '22000' THEN
      IF SQLERRM <> 'domain_event_idempotency_conflict' THEN
        RAISE;
      END IF;
  END;
END;
$$ LANGUAGE plpgsql;

ROLLBACK;
