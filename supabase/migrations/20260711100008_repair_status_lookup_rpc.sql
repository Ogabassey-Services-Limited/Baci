-- Public customer repair-status lookup (enumeration-safe).
--
-- Mirrors get_order_tracking: a SECURITY DEFINER function so the unauthenticated
-- storefront status page can read a single repair WITHOUT anon table grants on
-- public.repairs (which were revoked in the anon-hardening migration). Access
-- control lives in the WHERE clause: the caller must supply the merchant id AND
-- the exact ticket number AND the matching (case-insensitive) email. A wrong
-- email or a non-existent ticket both return zero rows, so a valid ticket cannot
-- be confirmed without also knowing the booking email (no enumeration).

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
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
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
    AND lower(r.customer_email) = lower(trim(coalesce(p_email, '')));
$$;

COMMENT ON FUNCTION public.get_repair_status(uuid, integer, text) IS
  'Enumeration-safe public repair status lookup: returns a row only when merchant id + ticket number + normalized email all match. Used by the storefront /repair/status page.';

REVOKE ALL ON FUNCTION public.get_repair_status(uuid, integer, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_repair_status(uuid, integer, text)
  TO anon, authenticated, service_role;
