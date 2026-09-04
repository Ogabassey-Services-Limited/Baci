-- REGRESSION: unpaid pickup reclaim must go through the merchant-bound
-- repair_pickup_receiver capability (SECURITY DEFINER). Ordinary JWTs must
-- not learn repair UUIDs/tickets from email + merchant alone.

BEGIN;

SET LOCAL ROLE service_role;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);

INSERT INTO public.merchants (id, email, business_name, slug, is_published)
VALUES (
  '84a63d82-0000-4000-8000-000000000001',
  'resumable-pickup@example.com',
  'Resumable Pickup Merchant',
  'resumable-pickup-merchant',
  true
);

INSERT INTO public.repairs (
  id,
  merchant_id,
  customer_name,
  customer_email,
  customer_phone,
  device_type,
  device_model,
  issue_description,
  service_type,
  pickup_address,
  status,
  created_at
)
VALUES (
  '84a63d82-0000-4000-8000-000000000010',
  '84a63d82-0000-4000-8000-000000000001',
  'Ada Lovelace',
  'ada@example.com',
  '+2348012345678',
  'Smartphone',
  'iPhone 15',
  'Screen unresponsive',
  'pickup',
  '12 Station Road, Osogbo',
  'pending',
  now() - interval '30 minutes'
);

SET LOCAL ROLE repair_pickup_receiver;

DO $$
DECLARE
  found_id uuid;
  found_ticket integer;
  expected_ticket integer;
BEGIN
  SELECT repairs.ticket_number
  INTO expected_ticket
  FROM public.repairs AS repairs
  WHERE repairs.id = '84a63d82-0000-4000-8000-000000000010';

  IF EXISTS (
    SELECT 1
    FROM public.find_resumable_repair_pickup(
      '84a63d82-0000-4000-8000-000000000001',
      'Ada@Example.com'
    )
  ) THEN
    RAISE EXCEPTION 'unscoped receiver role reclaimed a pickup ticket';
  END IF;

  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'role', 'repair_pickup_receiver',
      'repair_pickup_receiver_context', 'server-quote',
      'repair_pickup_receiver_merchant_id',
      '84a63d82-0000-4000-8000-000000000001'
    )::text,
    true
  );

  SELECT reclaim.id, reclaim.ticket_number
  INTO found_id, found_ticket
  FROM public.find_resumable_repair_pickup(
    '84a63d82-0000-4000-8000-000000000001',
    'Ada@Example.com'
  ) AS reclaim;

  IF found_id IS DISTINCT FROM '84a63d82-0000-4000-8000-000000000010'::uuid
    OR found_ticket IS DISTINCT FROM expected_ticket
  THEN
    RAISE EXCEPTION
      'expected matching unpaid pickup; got id=% ticket=%',
      found_id,
      found_ticket;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.find_resumable_repair_pickup(
      '84a63d82-0000-4000-8000-000000000001',
      'other@example.com'
    )
  ) THEN
    RAISE EXCEPTION 'mismatched email must not reclaim a pickup ticket';
  END IF;

  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'role', 'repair_pickup_receiver',
      'repair_pickup_receiver_context', 'server-quote',
      'repair_pickup_receiver_merchant_id',
      '84a63d82-0000-4000-8000-000000000099'
    )::text,
    true
  );

  IF EXISTS (
    SELECT 1
    FROM public.find_resumable_repair_pickup(
      '84a63d82-0000-4000-8000-000000000001',
      'Ada@Example.com'
    )
  ) THEN
    RAISE EXCEPTION 'mismatched merchant capability must not reclaim a ticket';
  END IF;
END;
$$;

RESET ROLE;

DO $$
BEGIN
  IF has_function_privilege(
    'anon',
    'public.find_resumable_repair_pickup(uuid, text)',
    'EXECUTE'
  ) OR has_function_privilege(
    'authenticated',
    'public.find_resumable_repair_pickup(uuid, text)',
    'EXECUTE'
  ) OR has_function_privilege(
    'service_role',
    'public.find_resumable_repair_pickup(uuid, text)',
    'EXECUTE'
  ) OR NOT has_function_privilege(
    'repair_pickup_receiver',
    'public.find_resumable_repair_pickup(uuid, text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'resumable pickup grant is not limited to scoped role';
  END IF;
END;
$$;

ROLLBACK;
