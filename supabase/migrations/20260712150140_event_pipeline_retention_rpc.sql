-- Bounded cleanup for successful destination attempt history.

CREATE OR REPLACE FUNCTION public.cleanup_domain_event_pipeline_v1(
  p_delivered_attempt_retention interval DEFAULT interval '30 days',
  p_queue_archive_retention interval DEFAULT interval '30 days'
) RETURNS TABLE (
  delivery_attempts_deleted bigint,
  queue_archive_messages_deleted bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET statement_timeout = '30s'
AS $$
DECLARE
  v_attempts_deleted bigint;
  v_archive_deleted bigint;
BEGIN
  IF COALESCE((SELECT auth.role()), '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden: cleanup_domain_event_pipeline_v1 requires service_role'
      USING ERRCODE = '42501';
  END IF;
  IF p_delivered_attempt_retention < interval '30 days' THEN
    RAISE EXCEPTION 'delivered_attempt_retention_must_be_at_least_30_days'
      USING ERRCODE = '22023';
  END IF;
  IF p_queue_archive_retention < interval '30 days' THEN
    RAISE EXCEPTION 'queue_archive_retention_must_be_at_least_30_days'
      USING ERRCODE = '22023';
  END IF;

  WITH expired_attempts AS (
    SELECT attempt.id
    FROM public.event_delivery_attempts AS attempt
    JOIN public.event_deliveries AS delivery
      ON delivery.id = attempt.delivery_id
    WHERE delivery.status IN ('delivered', 'skipped')
      AND attempt.finished_at < now() - p_delivered_attempt_retention
    ORDER BY attempt.finished_at
    LIMIT 10000
  )
  DELETE FROM public.event_delivery_attempts AS attempt
  USING expired_attempts AS expired
  WHERE attempt.id = expired.id;
  GET DIAGNOSTICS v_attempts_deleted = ROW_COUNT;

  WITH expired_archive AS (
    SELECT archive.ctid
    FROM pgmq.a_domain_events AS archive
    WHERE archive.archived_at < now() - p_queue_archive_retention
    ORDER BY archive.archived_at
    LIMIT 10000
  )
  DELETE FROM pgmq.a_domain_events AS archive
  USING expired_archive AS expired
  WHERE archive.ctid = expired.ctid;
  GET DIAGNOSTICS v_archive_deleted = ROW_COUNT;

  RETURN QUERY SELECT v_attempts_deleted, v_archive_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_domain_event_pipeline_v1(interval, interval)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_domain_event_pipeline_v1(interval, interval)
  TO service_role;
