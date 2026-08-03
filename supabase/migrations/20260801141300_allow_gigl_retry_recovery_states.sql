-- Retryable GIGL failures may recover to a newer nonterminal lifecycle state.

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
    WHEN 'failed' THEN 0
    WHEN 'delivered' THEN 6
    WHEN 'cancelled' THEN 7
    WHEN 'returned' THEN 7
    ELSE -1
  END::smallint;
$$;

ALTER FUNCTION private.gigl_tracking_status_rank(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.gigl_tracking_status_rank(text)
  FROM PUBLIC, anon, authenticated, service_role;
