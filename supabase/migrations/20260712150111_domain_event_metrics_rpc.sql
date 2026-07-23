-- Service-only ingress queue metrics.

CREATE OR REPLACE FUNCTION public.get_domain_event_queue_metrics_v1()
RETURNS TABLE (
  queue_length bigint,
  newest_message_age_seconds integer,
  oldest_message_age_seconds integer,
  total_messages bigint,
  measured_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET statement_timeout = '2s'
AS $$
BEGIN
  IF COALESCE((SELECT auth.role()), '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden: get_domain_event_queue_metrics_v1 requires service_role'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    metrics.queue_length,
    metrics.newest_msg_age_sec,
    metrics.oldest_msg_age_sec,
    metrics.total_messages,
    metrics.scrape_time
  FROM pgmq.metrics('domain_events') AS metrics;
END;
$$;

REVOKE ALL ON FUNCTION public.get_domain_event_queue_metrics_v1()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_domain_event_queue_metrics_v1()
  TO service_role;
