-- Throttle direct calls to the public repair-status lookup (fix for 20260708090700).
--
-- get_repair_status is anon-EXECUTE, so it is callable straight through
-- /rest/v1/rpc, bypassing the storefront route's 10/min limiter. Unlike the
-- get_order_tracking precedent (uuid order ids / opaque tracking tokens), the
-- repair ticket_number is a SMALL SEQUENTIAL integer: an attacker who knows a
-- customer's email could iterate the ticket space for a merchant. Add a
-- DB-side cap keyed on exactly that enumeration vector — (merchant, normalized
-- email) — via the existing public.check_rate_limit / rate_limit_log infra
-- (callable here despite anon's revoked EXECUTE because this function is
-- SECURITY DEFINER and runs as its owner).
--
-- Behavior notes:
--   * Throttled callers get an EMPTY result — byte-identical to "not found",
--     so the enumeration-safe response shape is preserved.
--   * The limiter is fail-open: if check_rate_limit ever errors, the lookup
--     proceeds (the app route's own 10/min limiter remains the first line).
--   * 60 lookups per (merchant, email) per hour: far above any legitimate
--     customer's polling, but it turns a ticket-space sweep into weeks.
--   * plpgsql (volatile) instead of the previous STABLE sql function because
--     the limiter writes a counter row; supabase-js .rpc() POSTs, so a
--     volatile function is fine for the existing route.

CREATE OR REPLACE FUNCTION public.get_repair_status(
  p_merchant_id uuid,
  p_ticket_number integer,
  p_email text
)
RETURNS TABLE (
  ticket_number integer,
  status public.repair_status,
  device_type text,
  device_model text,
  repair_type_label text,
  service_type text,
  created_at timestamptz,
  updated_at timestamptz,
  tracking_number text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text := lower(trim(coalesce(p_email, '')));
  v_allowed boolean := true;
BEGIN
  IF p_merchant_id IS NULL OR p_ticket_number IS NULL OR v_email = '' THEN
    RETURN;
  END IF;

  BEGIN
    v_allowed := public.check_rate_limit(
      'repair-status:' || p_merchant_id::text || ':' || v_email,
      'repair_status_rpc',
      60,
      60
    );
  EXCEPTION WHEN OTHERS THEN
    -- Fail-open: the storefront route's own limiter is the first line; a
    -- limiter infrastructure error must not break legitimate status lookups.
    v_allowed := true;
  END;

  IF NOT v_allowed THEN
    RETURN; -- empty: indistinguishable from "not found" (no enumeration signal)
  END IF;

  RETURN QUERY
  SELECT
    r.ticket_number,
    r.status,
    r.device_type,
    r.device_model,
    r.repair_type_label,
    r.service_type,
    r.created_at,
    r.updated_at,
    s.tracking_number
  FROM public.repairs AS r
  LEFT JOIN public.shipments AS s ON s.id = r.shipment_id
  WHERE r.merchant_id = p_merchant_id
    AND r.ticket_number = p_ticket_number
    AND lower(r.customer_email) = v_email;
END;
$$;

COMMENT ON FUNCTION public.get_repair_status(uuid, integer, text) IS
  'Enumeration-safe public repair status lookup: returns a row only when merchant id + ticket number + normalized email all match. DB-side throttle (60/hr per merchant+email via check_rate_limit) blunts direct-RPC ticket-space sweeps; throttled calls return empty, identical to not-found. Used by the storefront /repair/status page.';

REVOKE ALL ON FUNCTION public.get_repair_status(uuid, integer, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_repair_status(uuid, integer, text)
  TO anon, authenticated, service_role;
