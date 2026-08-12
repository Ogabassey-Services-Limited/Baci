CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;

CREATE FUNCTION public.claim_order_notification_outbox(
  p_limit integer,
  p_worker_id text
)
RETURNS SETOF text
LANGUAGE sql
AS $$
  SELECT concat(p_limit, ':', p_worker_id);
$$;

GRANT EXECUTE ON FUNCTION public.claim_order_notification_outbox(integer, text)
  TO anon, authenticated;
