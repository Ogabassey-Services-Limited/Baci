DO $$
DECLARE
  v_function_oid oid :=
    to_regprocedure('public.cancel_order_as_customer(uuid,text)');
BEGIN
  IF v_function_oid IS NULL THEN
    RAISE EXCEPTION 'production-old cancellation function is missing';
  END IF;

  IF NOT has_function_privilege(
    'service_role',
    v_function_oid,
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION
      'production-old cancellation function must retain service_role execution';
  END IF;

  INSERT INTO auth.users (id)
  VALUES ('00000000-0000-4000-8000-00000000d101');

  INSERT INTO public.merchants (
    id,
    email,
    user_id,
    business_name,
    slug
  )
  VALUES (
    '00000000-0000-4000-8000-00000000d201',
    'production-old-cancellation@example.invalid',
    '00000000-0000-4000-8000-00000000d101',
    'Production Old Cancellation',
    'production-old-cancellation'
  );

  INSERT INTO public.customers (
    id,
    merchant_id,
    user_id,
    email
  )
  VALUES (
    '00000000-0000-4000-8000-00000000d301',
    '00000000-0000-4000-8000-00000000d201',
    '00000000-0000-4000-8000-00000000d101',
    'production-old-customer@example.invalid'
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
      '00000000-0000-4000-8000-00000000d401',
      '00000000-0000-4000-8000-00000000d201',
      '00000000-0000-4000-8000-00000000d301',
      'PRODUCTION-OLD-LONG',
      'Production Old Customer',
      'production-old-customer@example.invalid',
      'pending',
      'unpaid',
      100
    ),
    (
      '00000000-0000-4000-8000-00000000d402',
      '00000000-0000-4000-8000-00000000d201',
      '00000000-0000-4000-8000-00000000d301',
      'PRODUCTION-OLD-TRIM',
      'Production Old Customer',
      'production-old-customer@example.invalid',
      'pending',
      'unpaid',
      100
    ),
    (
      '00000000-0000-4000-8000-00000000d403',
      '00000000-0000-4000-8000-00000000d201',
      '00000000-0000-4000-8000-00000000d301',
      'PRODUCTION-OLD-BLANK',
      'Production Old Customer',
      'production-old-customer@example.invalid',
      'pending',
      'unpaid',
      100
    );
END;
$$ LANGUAGE plpgsql;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-00000000d101',
  true
);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

DO $$
BEGIN
  IF NOT public.cancel_order_as_customer(
    '00000000-0000-4000-8000-00000000d401',
    repeat('x', 501)
  ) THEN
    RAISE EXCEPTION
      'production-old cancellation unexpectedly rejected 501 characters';
  END IF;

  IF NOT public.cancel_order_as_customer(
    '00000000-0000-4000-8000-00000000d402',
    '  Customer changed their mind  '
  ) THEN
    RAISE EXCEPTION 'production-old whitespace cancellation failed';
  END IF;

  IF NOT public.cancel_order_as_customer(
    '00000000-0000-4000-8000-00000000d403',
    '   '
  ) THEN
    RAISE EXCEPTION 'production-old blank cancellation failed';
  END IF;
END;
$$ LANGUAGE plpgsql;

RESET ROLE;

DO $$
DECLARE
  v_blank text;
  v_long text;
  v_spaced text;
BEGIN
  SELECT cancellation_reason
  INTO v_long
  FROM public.orders
  WHERE id = '00000000-0000-4000-8000-00000000d401';

  SELECT cancellation_reason
  INTO v_spaced
  FROM public.orders
  WHERE id = '00000000-0000-4000-8000-00000000d402';

  SELECT cancellation_reason
  INTO v_blank
  FROM public.orders
  WHERE id = '00000000-0000-4000-8000-00000000d403';

  IF char_length(v_long) IS DISTINCT FROM 501 THEN
    RAISE EXCEPTION 'production-old long reason was not stored';
  END IF;

  IF v_spaced IS DISTINCT FROM '  Customer changed their mind  ' THEN
    RAISE EXCEPTION 'production-old reason was unexpectedly trimmed';
  END IF;

  IF v_blank IS DISTINCT FROM '   ' THEN
    RAISE EXCEPTION 'production-old blank reason unexpectedly became NULL';
  END IF;
END;
$$ LANGUAGE plpgsql;
