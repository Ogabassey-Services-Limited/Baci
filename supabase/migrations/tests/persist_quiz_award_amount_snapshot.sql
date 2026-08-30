-- =============================================
-- REGRESSION TEST: quiz award amount snapshots
--   Executes both snapshot trigger paths and reapplies the migration against
--   legacy-shaped rows to verify its historical backfill.
--
-- USAGE:
--   psql $DATABASE_URL -v ON_ERROR_STOP=1 \
--     -f supabase/migrations/tests/persist_quiz_award_amount_snapshot.sql
-- =============================================

BEGIN;

DO $$
DECLARE
  v_merchant_id uuid := '00000000-0000-4000-8000-00000000a101';
  v_customer_id uuid := '00000000-0000-4000-8000-00000000a102';
  v_event_id uuid := '00000000-0000-4000-8000-00000000a103';
  v_ordinary_attempt_id uuid := '00000000-0000-4000-8000-00000000a104';
  v_reserved_attempt_id uuid := '00000000-0000-4000-8000-00000000a105';
  v_order_id uuid := '00000000-0000-4000-8000-00000000a106';
  v_ordinary_item_id uuid := '00000000-0000-4000-8000-00000000a107';
  v_reserved_item_id uuid := '00000000-0000-4000-8000-00000000a108';
  v_ordinary_award_id uuid := '00000000-0000-4000-8000-00000000a109';
  v_reserved_award_id uuid := '00000000-0000-4000-8000-00000000a10a';
BEGIN
  -- Replay checks run as the database owner, but several quiz/order triggers
  -- still require a request identity. Use the fixture customer as the
  -- authenticated subject so those existing guards are exercised normally.
  PERFORM set_config(
    'request.jwt.claim.sub',
    v_customer_id::text,
    true
  );
  PERFORM set_config(
    'request.jwt.claims',
    pg_catalog.json_build_object('sub', v_customer_id::text)::text,
    true
  );

  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (
    v_merchant_id,
    'quiz-award-snapshot-test@example.com',
    'Quiz Award Snapshot Test',
    'quiz-award-snapshot-test'
  );

  INSERT INTO public.customers (id, merchant_id, email, full_name)
  VALUES (
    v_customer_id,
    v_merchant_id,
    'quiz-award-customer@example.com',
    'Quiz Award Snapshot Customer'
  );

  INSERT INTO public.quiz_events (id, merchant_id, slug, title, status)
  VALUES (
    v_event_id,
    v_merchant_id,
    'quiz-award-snapshot-test',
    'Quiz Award Snapshot Test',
    'active'
  );

  INSERT INTO public.quiz_attempts (id, event_id, customer_id, attempt_number)
  VALUES
    (v_ordinary_attempt_id, v_event_id, v_customer_id, 1),
    (v_reserved_attempt_id, v_event_id, v_customer_id, 2);

  INSERT INTO public.orders (
    id,
    merchant_id,
    order_number,
    customer_name,
    customer_email,
    total,
    subtotal,
    payment_status,
    shipping_status,
    source
  ) VALUES (
    v_order_id,
    v_merchant_id,
    'QUIZ-AWARD-SNAPSHOT-TEST',
    'Quiz Award Snapshot Customer',
    'quiz-award-customer@example.com',
    0,
    0,
    'paid',
    'pending',
    'quiz_prize'
  );

  -- Create rows with the shape seen before this migration. The migration is
  -- reapplied below so its own backfill statements, not a test copy, repair
  -- both historical paths.
  ALTER TABLE public.order_items
    DISABLE TRIGGER sync_order_item_quiz_award_snapshot;
  ALTER TABLE public.quiz_awards
    DISABLE TRIGGER sync_reserved_quiz_award_order_item;

  INSERT INTO public.quiz_awards (
    id,
    event_id,
    attempt_id,
    customer_id,
    award_type,
    status,
    amount
  ) VALUES (
    v_ordinary_award_id,
    v_event_id,
    v_ordinary_attempt_id,
    v_customer_id,
    'store_credit',
    'claimed',
    125
  );

  INSERT INTO public.order_items (
    id,
    order_id,
    name,
    price,
    quantity,
    quiz_award_id,
    quiz_award_amount
  ) VALUES (
    v_ordinary_item_id,
    v_order_id,
    'Ordinary quiz voucher item',
    500,
    1,
    v_ordinary_award_id,
    NULL
  );

  INSERT INTO public.order_items (
    id,
    order_id,
    name,
    price,
    quantity,
    quiz_award_id,
    quiz_award_amount
  ) VALUES (
    v_reserved_item_id,
    v_order_id,
    'Reserved serialized quiz prize',
    0,
    1,
    NULL,
    NULL
  );

  INSERT INTO public.quiz_awards (
    id,
    event_id,
    attempt_id,
    customer_id,
    award_type,
    status,
    amount,
    reserved_order_id,
    reserved_order_item_id
  ) VALUES (
    v_reserved_award_id,
    v_event_id,
    v_reserved_attempt_id,
    v_customer_id,
    'store_credit',
    'claimed',
    475,
    v_order_id,
    v_reserved_item_id
  );
END;
$$ LANGUAGE plpgsql;

-- Reapply the exact migration so its trigger definitions and historical
-- backfill statements run against the legacy-shaped rows above.
\ir ../20260829090000_persist_quiz_award_amount_snapshot.sql

DO $$
DECLARE
  v_ordinary_item_id uuid := '00000000-0000-4000-8000-00000000a107';
  v_reserved_item_id uuid := '00000000-0000-4000-8000-00000000a108';
  v_ordinary_award_id uuid := '00000000-0000-4000-8000-00000000a109';
  v_reserved_award_id uuid := '00000000-0000-4000-8000-00000000a10a';
  v_award_id uuid;
  v_amount numeric;
BEGIN
  -- Historical ordinary voucher rows are repaired from their award id.
  SELECT quiz_award_id, quiz_award_amount
  INTO v_award_id, v_amount
  FROM public.order_items
  WHERE id = v_ordinary_item_id;
  IF v_award_id IS DISTINCT FROM v_ordinary_award_id OR v_amount IS DISTINCT FROM 125 THEN
    RAISE EXCEPTION
      'ordinary voucher backfill mismatch: award %, amount %',
      v_award_id,
      v_amount;
  END IF;

  -- Historical serialized prize rows are repaired from the award's reserved
  -- order-item link, which also restores the voucher identity.
  SELECT quiz_award_id, quiz_award_amount
  INTO v_award_id, v_amount
  FROM public.order_items
  WHERE id = v_reserved_item_id;
  IF v_award_id IS DISTINCT FROM v_reserved_award_id OR v_amount IS DISTINCT FROM 475 THEN
    RAISE EXCEPTION
      'serialized prize backfill mismatch: award %, amount %',
      v_award_id,
      v_amount;
  END IF;

  -- The order-item trigger must replace a client-supplied amount with the
  -- server-authoritative ordinary award amount.
  UPDATE public.order_items
  SET quiz_award_amount = 999
  WHERE id = v_ordinary_item_id;
  SELECT quiz_award_amount INTO v_amount
  FROM public.order_items
  WHERE id = v_ordinary_item_id;
  IF v_amount IS DISTINCT FROM 125 THEN
    RAISE EXCEPTION 'ordinary voucher trigger accepted client amount %', v_amount;
  END IF;

  -- The award trigger must propagate an amount change to a reserved prize
  -- order item, and the order-item trigger must preserve that same value.
  UPDATE public.quiz_awards
  SET amount = 525
  WHERE id = v_reserved_award_id;
  SELECT quiz_award_id, quiz_award_amount
  INTO v_award_id, v_amount
  FROM public.order_items
  WHERE id = v_reserved_item_id;
  IF v_award_id IS DISTINCT FROM v_reserved_award_id OR v_amount IS DISTINCT FROM 525 THEN
    RAISE EXCEPTION
      'serialized prize trigger mismatch: award %, amount %',
      v_award_id,
      v_amount;
  END IF;
END;
$$ LANGUAGE plpgsql;

ROLLBACK;
