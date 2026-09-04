-- REGRESSION: unpaid pickup reclaim must go through SECURITY DEFINER RPC,
-- not a direct repairs SELECT (anon RLS denies table reads).

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

DO $$
DECLARE
  found_id uuid;
  found_ticket integer;
  expected_ticket integer;
BEGIN
  SELECT ticket_number
  INTO expected_ticket
  FROM public.repairs
  WHERE id = '84a63d82-0000-4000-8000-000000000010';

  SELECT id, ticket_number
  INTO found_id, found_ticket
  FROM public.find_resumable_repair_pickup(
    '84a63d82-0000-4000-8000-000000000001',
    'Ada@Example.com'
  );

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
END;
$$;

ROLLBACK;
