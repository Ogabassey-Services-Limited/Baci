-- Keep one-time milestones deduplicated while allowing each retryable delivery
-- attempt to produce its own notification for the same tracking epoch.

WITH ranked_milestones AS (
  SELECT
    outbox.id,
    row_number() OVER (
      PARTITION BY outbox.shipment_id, outbox.tracking_epoch_id,
        outbox.audience, outbox.notification_kind
      ORDER BY CASE outbox.status
        WHEN 'sent' THEN 0
        WHEN 'processing' THEN 1
        WHEN 'pending' THEN 2
        WHEN 'failed' THEN 3
        ELSE 4
      END, outbox.created_at ASC, outbox.id ASC
    ) AS duplicate_rank
  FROM public.shipment_tracking_notification_outbox AS outbox
  WHERE outbox.notification_kind NOT IN ('failed', 'delivery_attempt_failed')
)
DELETE FROM public.shipment_tracking_notification_outbox AS duplicate
USING ranked_milestones AS ranked
WHERE duplicate.id = ranked.id
  AND ranked.duplicate_rank > 1;

ALTER TABLE public.shipment_tracking_notification_outbox
  DROP CONSTRAINT IF EXISTS shipment_tracking_notifications_identity_key;

CREATE UNIQUE INDEX IF NOT EXISTS
  shipment_tracking_notifications_milestone_identity_key
  ON public.shipment_tracking_notification_outbox (
    shipment_id, tracking_epoch_id, audience, notification_kind
  )
  WHERE notification_kind NOT IN ('failed', 'delivery_attempt_failed');

CREATE UNIQUE INDEX IF NOT EXISTS
  shipment_tracking_notifications_attempt_identity_key
  ON public.shipment_tracking_notification_outbox (
    shipment_id, tracking_epoch_id, tracking_event_id, audience, notification_kind
  )
  WHERE notification_kind IN ('failed', 'delivery_attempt_failed');

-- The result function was defined before the partial indexes existed. Rebind
-- its conflict handler so either identity remains a safe no-op under races.
DO $migration$
DECLARE
  v_original_definition text;
  v_definition text;
BEGIN
  SELECT pg_get_functiondef(
    'public.apply_gigl_tracking_result(uuid, uuid, text, text, text, timestamptz, jsonb)'::regprocedure
  ) INTO v_original_definition;
  v_definition := replace(
    v_original_definition,
    'v_latest_incoming_event_at <= v_manual_terminal_override_at',
    '(v_latest_status_event_at IS NULL OR v_latest_status_event_at <= v_manual_terminal_override_at)'
  );
  v_definition := replace(
    v_definition,
    'v_latest_incoming_event_at > v_manual_terminal_override_at',
    'v_latest_status_event_at IS NOT NULL AND v_latest_status_event_at > v_manual_terminal_override_at'
  );
  v_definition := regexp_replace(
    v_definition,
    E'ON CONFLICT \\(\\s*shipment_id, tracking_epoch_id, tracking_event_id, audience, notification_kind\\s*\\)\\s*DO NOTHING',
    'ON CONFLICT DO NOTHING',
    'g'
  );
  IF v_definition = v_original_definition
    OR v_definition NOT LIKE '%ON CONFLICT DO NOTHING%' THEN
    RAISE EXCEPTION 'GIGL tracking result function identity hardening did not apply';
  END IF;
  EXECUTE v_definition;
END;
$migration$;
