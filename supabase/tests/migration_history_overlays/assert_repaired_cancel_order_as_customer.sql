DO $$
DECLARE
  v_authenticated oid := 'authenticated'::regrole::oid;
  v_function_oid oid;
  v_owner oid;
BEGIN
  SELECT to_regprocedure('public.cancel_order_as_customer(uuid,text)')
  INTO v_function_oid;

  IF v_function_oid IS NULL THEN
    RAISE EXCEPTION 'public.cancel_order_as_customer(uuid,text) is missing';
  END IF;

  SELECT proc.proowner
  INTO v_owner
  FROM pg_proc AS proc
  WHERE proc.oid = v_function_oid;

  IF NOT EXISTS (
    SELECT 1
    FROM aclexplode(
      COALESCE(
        (SELECT proc.proacl FROM pg_proc AS proc
         WHERE proc.oid = v_function_oid),
        acldefault('f', v_owner)
      )
    ) AS privilege
    WHERE privilege.privilege_type = 'EXECUTE'
      AND privilege.grantee = v_authenticated
  ) THEN
    RAISE EXCEPTION
      'public.cancel_order_as_customer(uuid,text) must grant EXECUTE to authenticated';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM aclexplode(
      COALESCE(
        (SELECT proc.proacl FROM pg_proc AS proc
         WHERE proc.oid = v_function_oid),
        acldefault('f', v_owner)
      )
    ) AS privilege
    WHERE privilege.privilege_type = 'EXECUTE'
      AND privilege.grantee <> v_owner
      AND privilege.grantee IS DISTINCT FROM v_authenticated
  ) THEN
    RAISE EXCEPTION
      'authenticated must be the only non-owner direct executor';
  END IF;

  INSERT INTO auth.users (id)
  VALUES ('00000000-0000-4000-8000-00000000c101');

  INSERT INTO public.merchants (
    id,
    email,
    user_id,
    business_name,
    slug
  )
  VALUES (
    '00000000-0000-4000-8000-00000000c201',
    'cancellation-reason-merchant@example.invalid',
    '00000000-0000-4000-8000-00000000c101',
    'Cancellation Reason Merchant',
    'cancellation-reason-merchant'
  );

  INSERT INTO public.customers (
    id,
    merchant_id,
    user_id,
    email
  )
  VALUES (
    '00000000-0000-4000-8000-00000000c301',
    '00000000-0000-4000-8000-00000000c201',
    '00000000-0000-4000-8000-00000000c101',
    'cancellation-reason-customer@example.invalid'
  );

  INSERT INTO public.orders (
    id,
    merchant_id,
    customer_id,
    order_number,
    customer_name,
    customer_email,
    shipping_status,
    payment_status,
    total
  )
  VALUES
    (
      '00000000-0000-4000-8000-00000000c401',
      '00000000-0000-4000-8000-00000000c201',
      '00000000-0000-4000-8000-00000000c301',
      'CANCEL-REASON-TRIM',
      'Cancellation Reason Customer',
      'cancellation-reason-customer@example.invalid',
      'pending',
      'unpaid',
      100
    ),
    (
      '00000000-0000-4000-8000-00000000c402',
      '00000000-0000-4000-8000-00000000c201',
      '00000000-0000-4000-8000-00000000c301',
      'CANCEL-REASON-BLANK',
      'Cancellation Reason Customer',
      'cancellation-reason-customer@example.invalid',
      'pending',
      'unpaid',
      100
    );
END;
$$ LANGUAGE plpgsql;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-00000000c101',
  true
);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

DO $$
BEGIN
  BEGIN
    PERFORM public.cancel_order_as_customer(
      '00000000-0000-4000-8000-00000000c401',
      repeat('x', 501)
    );

    RAISE EXCEPTION '501-character cancellation reason unexpectedly succeeded';
  EXCEPTION
    WHEN SQLSTATE '22001' THEN
      IF SQLERRM <> 'reason_too_long' THEN
        RAISE;
      END IF;
  END;

  IF NOT public.cancel_order_as_customer(
    '00000000-0000-4000-8000-00000000c401',
    '  Customer changed their mind  '
  ) THEN
    RAISE EXCEPTION 'trimmed cancellation did not update the owned order';
  END IF;

  IF NOT public.cancel_order_as_customer(
    '00000000-0000-4000-8000-00000000c402',
    '   '
  ) THEN
    RAISE EXCEPTION 'blank-reason cancellation did not update the owned order';
  END IF;
END;
$$ LANGUAGE plpgsql;

RESET ROLE;

DO $$
DECLARE
  v_blank_reason text;
  v_trimmed_reason text;
BEGIN
  SELECT cancellation_reason
  INTO v_trimmed_reason
  FROM public.orders
  WHERE id = '00000000-0000-4000-8000-00000000c401';

  SELECT cancellation_reason
  INTO v_blank_reason
  FROM public.orders
  WHERE id = '00000000-0000-4000-8000-00000000c402';

  IF v_trimmed_reason IS DISTINCT FROM 'Customer changed their mind' THEN
    RAISE EXCEPTION
      'cancellation reason was not trimmed before storage: %',
      COALESCE(v_trimmed_reason, '<null>');
  END IF;

  IF v_blank_reason IS NOT NULL THEN
    RAISE EXCEPTION
      'blank cancellation reason must store NULL, found: %',
      v_blank_reason;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.orders
    WHERE id IN (
      '00000000-0000-4000-8000-00000000c401',
      '00000000-0000-4000-8000-00000000c402'
    )
      AND (
        shipping_status IS DISTINCT FROM 'cancelled'
        OR cancelled_by IS DISTINCT FROM 'customer'
        OR cancelled_at IS NULL
      )
  ) THEN
    RAISE EXCEPTION 'customer cancellation metadata is incomplete';
  END IF;
END;
$$ LANGUAGE plpgsql;
