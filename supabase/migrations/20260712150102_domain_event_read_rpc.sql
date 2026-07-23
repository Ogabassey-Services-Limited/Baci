-- Service-only long-poll access to the durable ingress queue.

CREATE OR REPLACE FUNCTION public.read_domain_events_v1(
  p_visibility_timeout_seconds integer DEFAULT 60,
  p_batch_size integer DEFAULT 100,
  p_max_poll_seconds integer DEFAULT 5
) RETURNS TABLE (
  msg_id bigint,
  read_ct integer,
  enqueued_at timestamptz,
  visible_at timestamptz,
  message jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET statement_timeout = '10s'
AS $$
BEGIN
  IF COALESCE((SELECT auth.role()), '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden: read_domain_events_v1 requires service_role'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    queued.msg_id,
    queued.read_ct,
    queued.enqueued_at,
    queued.vt,
    queued.message
  FROM pgmq.read_with_poll(
    'domain_events',
    LEAST(GREATEST(COALESCE(p_visibility_timeout_seconds, 60), 10), 900),
    LEAST(GREATEST(COALESCE(p_batch_size, 100), 1), 200),
    LEAST(GREATEST(COALESCE(p_max_poll_seconds, 5), 0), 5),
    100
  ) AS queued;
END;
$$;

REVOKE ALL ON FUNCTION public.read_domain_events_v1(integer, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_domain_events_v1(integer, integer, integer)
  TO service_role;
