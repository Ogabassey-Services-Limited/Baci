-- Guard set_customer_date_of_birth against a soft-delete race. The customer
-- lookup filters `deleted_at IS NULL`, but the original UPDATE (in
-- 20260724150000_set_customer_date_of_birth_rpc.sql) filtered only by id, so a
-- row soft-deleted between the SELECT and the UPDATE (READ COMMITTED) would
-- still be written. Add the same predicate to the UPDATE and fail closed
-- (customer_not_found) when it matches no live row. Body is otherwise identical
-- to the original.

CREATE OR REPLACE FUNCTION public.set_customer_date_of_birth(
  p_merchant_id uuid,
  p_date_of_birth text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_customer_id uuid;
  v_trimmed text := pg_catalog.btrim(p_date_of_birth);
  v_dob date;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  -- Reject NULL/blank up front so a missing value can't silently CLEAR an
  -- existing date_of_birth after the UI gate has been satisfied.
  IF v_trimmed IS NULL OR v_trimmed = '' THEN
    RAISE EXCEPTION 'invalid_date_of_birth' USING ERRCODE = '22023';
  END IF;

  -- Require strict ISO YYYY-MM-DD (same shape the web schema enforces) so both
  -- clients feed the column identical input.
  IF v_trimmed !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RAISE EXCEPTION 'invalid_date_of_birth' USING ERRCODE = '22023';
  END IF;

  -- Cast to a real calendar date (rejects e.g. 1990-02-30) and surface the
  -- friendly code instead of the raw cast error (22007/22008).
  BEGIN
    v_dob := v_trimmed::date;
  EXCEPTION
    WHEN others THEN
      RAISE EXCEPTION 'invalid_date_of_birth' USING ERRCODE = '22023';
  END;

  -- Must be in the past and within a human lifespan (<= 120 years).
  IF v_dob >= pg_catalog.now()::date
     OR v_dob < (pg_catalog.now()::date - INTERVAL '120 years')::date THEN
    RAISE EXCEPTION 'invalid_date_of_birth' USING ERRCODE = '22023';
  END IF;

  -- Resolve the caller's customer row for THIS merchant.
  SELECT c.id INTO v_customer_id
  FROM public.customers c
  WHERE c.merchant_id = p_merchant_id
    AND c.user_id = v_user_id
    AND c.deleted_at IS NULL
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'customer_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Re-assert the live predicate on the write so a soft-delete committed
  -- between the SELECT and here cannot receive the DOB.
  UPDATE public.customers
     SET date_of_birth = v_dob
   WHERE id = v_customer_id
     AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'customer_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Canonical ISO text, DateStyle-independent, matching the column round-trip.
  RETURN pg_catalog.to_char(v_dob, 'YYYY-MM-DD');
END;
$$;

REVOKE ALL ON FUNCTION public.set_customer_date_of_birth(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_customer_date_of_birth(uuid, text) TO authenticated;
