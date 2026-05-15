-- =============================================
-- REGRESSION TEST: order number UUID offset
--   Validates 20260510233731_fix_order_number_uuid_offset.sql.
--
-- USAGE:
--   psql $DATABASE_URL -f supabase/migrations/tests/order_number_uuid_offset.sql
--
-- This script mutates counters and rolls back, proving UUID prefixes with the
-- high bit set no longer collapse generated order numbers to 0000.
-- =============================================

BEGIN ISOLATION LEVEL REPEATABLE READ;

INSERT INTO public.merchants (id, email, business_name, slug)
VALUES
  (
    '8f0ed783-0000-4000-8000-000000000101',
    'order-number-offset-a@example.com',
    'Order Number Offset A',
    'order-number-offset-a'
  ),
  (
    'd95a5a32-0000-4000-8000-000000000102',
    'order-number-offset-b@example.com',
    'Order Number Offset B',
    'order-number-offset-b'
  );

DO $$
DECLARE
  first_order_number text;
  second_order_number text;
BEGIN
  SELECT public.generate_improved_order_number('8f0ed783-0000-4000-8000-000000000101')
  INTO first_order_number;

  SELECT public.generate_improved_order_number('d95a5a32-0000-4000-8000-000000000102')
  INTO second_order_number;

  IF split_part(first_order_number, '-', 3) = '0000' THEN
    RAISE EXCEPTION 'first generated order number collapsed to 0000: %', first_order_number;
  END IF;

  IF split_part(second_order_number, '-', 3) = '0000' THEN
    RAISE EXCEPTION 'second generated order number collapsed to 0000: %', second_order_number;
  END IF;

  IF first_order_number = second_order_number THEN
    RAISE EXCEPTION
      'generated order numbers should differ across merchants: %',
      first_order_number;
  END IF;

  RAISE NOTICE
    'OK: generated order numbers kept non-zero merchant offsets: %, %',
    first_order_number,
    second_order_number;
END;
$$ LANGUAGE plpgsql;

ROLLBACK;
