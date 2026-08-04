-- Append-only repair for the failed GIGL retry-edge migration.
--
-- 20260801141800_harden_gigl_tracking_retry_edges.sql remains byte-for-byte
-- immutable. Its replacement-string expressions used adjacent PostgreSQL
-- literals without ||, so PostgreSQL rejected the migration before recording
-- it. The deployment applier reconciles that exact source and runs this
-- corrected final-state repair at the original migration's position.

CREATE OR REPLACE FUNCTION private.gigl_tracking_status_rank(p_status text)
RETURNS smallint
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = ''
AS $$
  SELECT CASE p_status
    WHEN 'pending' THEN 0
    WHEN 'booked' THEN 1
    WHEN 'pickup_scheduled' THEN 2
    WHEN 'picked_up' THEN 3
    WHEN 'in_transit' THEN 4
    WHEN 'out_for_delivery' THEN 5
    WHEN 'failed' THEN 5
    WHEN 'delivered' THEN 6
    WHEN 'cancelled' THEN 7
    WHEN 'returned' THEN 7
    ELSE -1
  END::smallint;
$$;

ALTER FUNCTION private.gigl_tracking_status_rank(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.gigl_tracking_status_rank(text)
  FROM PUBLIC, anon, authenticated, service_role;

DO $migration$
DECLARE
  v_original_definition text;
  v_definition text;
  v_expected_scope text;
BEGIN
  SELECT pg_get_functiondef(
    'private.sync_gigl_tracking_order_status()'::regprocedure
  ) INTO v_original_definition;
  v_definition := replace(
    v_original_definition,
    E'        AND newer_shipment.tracking_timeline_generation\n'
      || '          > NEW.tracking_timeline_generation',
    E'        AND newer_shipment.merchant_id = NEW.merchant_id\n'
      || E'        AND newer_shipment.tracking_timeline_generation\n'
      || '          > NEW.tracking_timeline_generation'
  );
  v_expected_scope :=
    E'        AND newer_shipment.merchant_id = NEW.merchant_id\n'
    || E'        AND newer_shipment.tracking_timeline_generation\n'
    || '          > NEW.tracking_timeline_generation';
  IF v_definition = v_original_definition
    OR v_definition NOT LIKE '%newer_shipment.merchant_id = NEW.merchant_id%'
    OR v_definition NOT LIKE '%newer_shipment.tracking_timeline_generation%'
    OR v_definition NOT LIKE '%> NEW.tracking_timeline_generation%'
    OR pg_catalog.strpos(v_definition, v_expected_scope) = 0
    OR (
      pg_catalog.length(v_definition)
      - pg_catalog.length(
        pg_catalog.replace(v_definition, v_expected_scope, '')
      )
    ) <> pg_catalog.length(v_expected_scope)
    OR pg_catalog.regexp_count(
      v_definition,
      'newer_shipment[.]merchant_id = NEW[.]merchant_id'
    ) <> 1
    OR pg_catalog.regexp_count(
      v_definition,
      'newer_shipment[.]tracking_timeline_generation[[:space:]]+>[[:space:]]+NEW[.]tracking_timeline_generation'
    ) <> 1 THEN
    RAISE EXCEPTION 'GIGL order status generation scope did not apply';
  END IF;
  EXECUTE v_definition;
END;
$migration$;

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
    E'    WHEN private.gigl_tracking_status_rank(p_status)\n'
      || E'      < private.gigl_tracking_status_rank(coalesce(v_current_status, ''pending''))\n'
      || '      THEN v_current_status',
    E'    WHEN v_current_status = ''failed''\n'
      || E'      AND p_status IN (''picked_up'', ''in_transit'', ''out_for_delivery'')\n'
      || E'      AND v_latest_status_event_at IS NOT NULL\n'
      || E'      AND (\n'
      || E'        v_latest_persisted_event_at IS NULL\n'
      || E'        OR v_latest_status_event_at >= v_latest_persisted_event_at\n'
      || E'      )\n'
      || E'      THEN p_status\n'
      || E'    WHEN private.gigl_tracking_status_rank(p_status)\n'
      || E'      < private.gigl_tracking_status_rank(coalesce(v_current_status, ''pending''))\n'
      || '      THEN v_current_status'
  );
  v_definition := replace(
    v_definition,
    '  v_should_update_delivery := p_actual_delivery IS NOT NULL',
    E'  v_should_update_delivery := v_effective_status = ''delivered''\n'
      || '    AND p_actual_delivery IS NOT NULL'
  );
  IF v_definition = v_original_definition
    OR v_definition NOT LIKE '%v_current_status = ''failed''%'
    OR v_definition NOT LIKE '%v_effective_status = ''delivered''%' THEN
    RAISE EXCEPTION 'GIGL tracking retry edge hardening did not apply';
  END IF;
  EXECUTE v_definition;
END;
$migration$;
