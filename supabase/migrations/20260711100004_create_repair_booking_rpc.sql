-- Repair booking write path: SECURITY DEFINER private function + SECURITY INVOKER
-- public wrapper, modeled on private.create_storefront_order.
--
-- Why an RPC: today's anonymous INSERT needs sequence USAGE for ticket_number and
-- a broad table grant. The RPC lets us drop the anon INSERT path entirely (see the
-- anon-hardening file) while keeping quote-only bookings server-validated:
--   * merchant must exist (free-text intake still allowed for non-catalogue merchants);
--   * when quote_id is supplied, the quote AND its device AND service type must be
--     is_active for that merchant (a stale/foreign quote id is rejected, not just
--     FK-valid), and quoted_price/repair_type_label/device_id are snapshotted
--     server-side (client-supplied price is never trusted);
--   * DB-side rate caps (per merchant+email per hour AND per-merchant hourly ceiling)
--     because the public wrapper is directly callable at /rest/v1/rpc with the anon key.

CREATE OR REPLACE FUNCTION private.create_repair_booking(
  p_merchant_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_device_type text,
  p_device_model text,
  p_issue_description text,
  p_preferred_date timestamptz DEFAULT NULL,
  p_service_type text DEFAULT 'dropoff',
  p_pickup_address text DEFAULT NULL,
  p_device_id uuid DEFAULT NULL,
  p_quote_id uuid DEFAULT NULL
)
RETURNS TABLE (id uuid, ticket_number integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_repair_id uuid := gen_random_uuid();
  v_ticket integer;
  v_service_type text := lower(trim(coalesce(p_service_type, 'dropoff')));
  v_normalized_email text := lower(trim(coalesce(p_customer_email, '')));
  v_catalog_enabled boolean;
  v_quoted_price numeric(12, 2);
  v_repair_type_label text;
  v_resolved_device_id uuid;
  v_per_email_count integer;
  v_per_merchant_count integer;
BEGIN
  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'merchant_required' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.merchants AS m WHERE m.id = p_merchant_id) THEN
    RAISE EXCEPTION 'merchant_not_found' USING ERRCODE = '22023';
  END IF;

  IF v_service_type NOT IN ('dropoff', 'pickup') THEN
    RAISE EXCEPTION 'invalid_service_type' USING ERRCODE = '22023';
  END IF;

  -- Abuse controls, counted from repairs.created_at (the public wrapper is
  -- directly callable with the anon key, bypassing the app-layer limiter).
  SELECT count(*) INTO v_per_email_count
  FROM public.repairs AS r
  WHERE r.merchant_id = p_merchant_id
    AND lower(r.customer_email) = v_normalized_email
    AND r.created_at > (now() - interval '1 hour');
  IF v_per_email_count >= 5 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_per_merchant_count
  FROM public.repairs AS r
  WHERE r.merchant_id = p_merchant_id
    AND r.created_at > (now() - interval '1 hour');
  IF v_per_merchant_count >= 100 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = '22023';
  END IF;

  v_catalog_enabled := public.repairs_catalog_publicly_enabled(p_merchant_id);

  IF p_quote_id IS NOT NULL THEN
    IF NOT v_catalog_enabled THEN
      RAISE EXCEPTION 'catalog_disabled' USING ERRCODE = '22023';
    END IF;

    SELECT rq.price, st.name, rq.device_id
      INTO v_quoted_price, v_repair_type_label, v_resolved_device_id
    FROM public.repair_quotes AS rq
    JOIN public.repair_devices AS rd
      ON rd.id = rq.device_id AND rd.merchant_id = rq.merchant_id
    JOIN public.repair_service_types AS st
      ON st.id = rq.service_type_id AND st.merchant_id = rq.merchant_id
    WHERE rq.id = p_quote_id
      AND rq.merchant_id = p_merchant_id
      AND rq.is_active
      AND rd.is_active
      AND st.is_active;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'quote_unavailable' USING ERRCODE = '22023';
    END IF;
  ELSIF p_device_id IS NOT NULL THEN
    IF NOT v_catalog_enabled THEN
      RAISE EXCEPTION 'catalog_disabled' USING ERRCODE = '22023';
    END IF;

    SELECT rd.id INTO v_resolved_device_id
    FROM public.repair_devices AS rd
    WHERE rd.id = p_device_id
      AND rd.merchant_id = p_merchant_id
      AND rd.is_active;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'device_unavailable' USING ERRCODE = '22023';
    END IF;
  END IF;

  INSERT INTO public.repairs (
    id, merchant_id, customer_name, customer_email, customer_phone,
    device_type, device_model, issue_description, preferred_date,
    service_type, pickup_address, status,
    device_id, quote_id, quoted_price, repair_type_label
  )
  VALUES (
    v_repair_id, p_merchant_id, p_customer_name, p_customer_email, p_customer_phone,
    p_device_type, p_device_model, p_issue_description, p_preferred_date,
    v_service_type, p_pickup_address, 'pending',
    v_resolved_device_id, p_quote_id, v_quoted_price, v_repair_type_label
  )
  RETURNING repairs.id, repairs.ticket_number
  INTO v_repair_id, v_ticket;

  RETURN QUERY SELECT v_repair_id AS id, v_ticket AS ticket_number;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_repair_booking(
  p_merchant_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_device_type text,
  p_device_model text,
  p_issue_description text,
  p_preferred_date timestamptz DEFAULT NULL,
  p_service_type text DEFAULT 'dropoff',
  p_pickup_address text DEFAULT NULL,
  p_device_id uuid DEFAULT NULL,
  p_quote_id uuid DEFAULT NULL
)
RETURNS TABLE (id uuid, ticket_number integer)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT booking.id, booking.ticket_number
  FROM private.create_repair_booking(
    p_merchant_id,
    p_customer_name,
    p_customer_email,
    p_customer_phone,
    p_device_type,
    p_device_model,
    p_issue_description,
    p_preferred_date,
    p_service_type,
    p_pickup_address,
    p_device_id,
    p_quote_id
  ) AS booking;
END;
$$;

-- The public wrapper is SECURITY INVOKER, so the caller's EXECUTE privilege is
-- checked on the inner private call too. Grant EXECUTE on BOTH after locking down.
-- The private schema is not exposed to PostgREST, keeping the inner fn off REST.
REVOKE ALL ON FUNCTION public.create_repair_booking(
  uuid, text, text, text, text, text, text, timestamptz, text, text, uuid, uuid
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_repair_booking(
  uuid, text, text, text, text, text, text, timestamptz, text, text, uuid, uuid
) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION private.create_repair_booking(
  uuid, text, text, text, text, text, text, timestamptz, text, text, uuid, uuid
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.create_repair_booking(
  uuid, text, text, text, text, text, text, timestamptz, text, text, uuid, uuid
) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.create_repair_booking(
  uuid, text, text, text, text, text, text, timestamptz, text, text, uuid, uuid
) IS 'Public storefront repair booking wrapper. Validates merchant + active quote/device, snapshots price server-side, enforces DB-side rate caps.';
