CREATE OR REPLACE FUNCTION public.cleanup_database_retention(
  p_analytics_low_value_retention interval DEFAULT interval '30 days',
  p_cron_retention interval DEFAULT interval '14 days',
  p_pg_net_retention interval DEFAULT interval '1 day'
)
RETURNS TABLE (
  analytics_events_deleted bigint,
  cron_job_run_details_deleted bigint,
  pg_net_responses_deleted bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, net
AS $$
BEGIN
  DELETE FROM public.analytics_events
  WHERE event_type IN ('page_view', 'search')
    AND COALESCE(event_timestamp, created_at) < clock_timestamp() - p_analytics_low_value_retention;
  GET DIAGNOSTICS analytics_events_deleted = ROW_COUNT;

  DELETE FROM cron.job_run_details
  WHERE COALESCE(end_time, start_time) < clock_timestamp() - p_cron_retention;
  GET DIAGNOSTICS cron_job_run_details_deleted = ROW_COUNT;

  DELETE FROM net._http_response
  WHERE created < clock_timestamp() - p_pg_net_retention;
  GET DIAGNOSTICS pg_net_responses_deleted = ROW_COUNT;

  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.cleanup_database_retention(interval, interval, interval)
  IS 'Service-role maintenance cleanup for low-value analytics events, pg_cron job history, and pg_net response history.';

REVOKE ALL ON FUNCTION public.cleanup_database_retention(interval, interval, interval)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_database_retention(interval, interval, interval)
  TO service_role;
