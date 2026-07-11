-- Follow-up hardening for the repair booking RPC (fixes for 20260711100004),
-- applied as CREATE OR REPLACE per the repo's follow-up-migration idiom.
--
-- 1. Per-email rate cap bypass: the cap counted matches with lower(customer_email)
--    but the stored email is untrimmed, so a whitespace-padded variant
--    ("  a@b.com") did not collide with the normalized key and slipped past the
--    per-email cap. Normalize BOTH sides of the count with lower(trim(...)). (The
--    per-merchant hourly ceiling already backstops total spend; this restores the
--    intended per-customer cap.)
-- 2. The public SECURITY INVOKER wrapper was missing a pinned search_path, which
--    trips the Supabase function-search-path linter. Pin it to '' (the wrapper
--    only calls the schema-qualified private function, so pinning is safe).
--
-- CREATE OR REPLACE preserves existing privileges; grants are re-asserted below
-- for clarity and idempotency.

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
  -- Normalize both sides so whitespace-padded email variants cannot evade the cap.
  SELECT count(*) INTO v_per_email_count
  FROM public.repairs AS r
  WHERE r.merchant_id = p_merchant_id
    AND lower(trim(r.customer_email)) = v_normalized_email
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
SET search_path = ''
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

-- Re-assert the locked-down grants (CREATE OR REPLACE preserves ACLs; explicit
-- here for clarity and idempotency).
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
