-- =============================================
-- REGRESSION TEST: business_address legacy writers and back-fill
--   Validates 20260617000200_derive_business_address_from_registered_address.sql.
--   Run after business_address_derivation.sql. Mutates inside a transaction.
-- =============================================
BEGIN;

-- 1. The trigger must work for an AUTHENTICATED client. The formatter has EXECUTE
--    revoked from authenticated; a SECURITY INVOKER trigger would fail with
--    "permission denied for function format_merchant_address". The SECURITY DEFINER
--    trigger resolves that nested call against the owner instead, so the update
--    succeeds and derives business_address. We grant a temporary permissive policy
--    so the row-level update reaches the trigger; everything rolls back.
DO $$
DECLARE
  derived text;
BEGIN
  INSERT INTO public.merchants (id, email, business_name, slug, registered_address)
  VALUES (
    '8f0ed783-0000-4000-8000-0000000003f2',
    'authed-derive@example.com',
    'Authed Derive Store',
    'authed-derive-store',
    jsonb_build_object('street', '15 Broad Street', 'city', 'Lagos', 'state', 'Lagos')
  )
  ON CONFLICT (id) DO NOTHING;

  GRANT SELECT, INSERT, UPDATE ON public.merchants TO authenticated;
  CREATE POLICY zz_test_authed_all ON public.merchants
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

  SET LOCAL ROLE authenticated;
  UPDATE public.merchants
  SET registered_address = jsonb_build_object('street', '7 Marina Road', 'city', 'Lagos Island')
  WHERE id = '8f0ed783-0000-4000-8000-0000000003f2';
  RESET ROLE;

  SELECT business_address
  INTO derived
  FROM public.merchants
  WHERE id = '8f0ed783-0000-4000-8000-0000000003f2';

  IF derived IS DISTINCT FROM '7 Marina Road, Lagos Island' THEN
    RAISE EXCEPTION 'authenticated registered_address update did not derive business_address, got: %', COALESCE(derived, '<null>');
  END IF;

  DROP POLICY zz_test_authed_all ON public.merchants;
  RAISE NOTICE 'OK: authenticated client update derives business_address (SECURITY DEFINER trigger)';
END;
$$ LANGUAGE plpgsql;

-- 2. The one-time back-fill must NOT wipe a legacy free-text-only address: a
--    merchant whose address lives only in business_address while
--    registered_address is still `{}` keeps its value.
--
--    In production these legacy rows already exist when the migration runs, so the
--    back-fill (not the trigger) is what could touch them. To reproduce that exact
--    state we seed the at-risk rows with the sync trigger temporarily DISABLED
--    (the INSERT trigger would otherwise immediately re-derive business_address
--    from the empty registered_address, masking the back-fill behaviour we are
--    testing). We then re-enable the trigger and replay the migration's back-fill
--    statement verbatim.
DO $$
DECLARE
  preserved text;
  derived text;
BEGIN
  ALTER TABLE public.merchants DISABLE TRIGGER zz_sync_business_address_from_registered;

  -- (a) free-text-only legacy row (registered_address = '{}')
  INSERT INTO public.merchants (id, email, business_name, slug, business_address, registered_address)
  VALUES (
    '8f0ed783-0000-4000-8000-0000000003f3',
    'freetext-only@example.com',
    'FreeText Only Store',
    'freetext-only-store',
    '99 Legacy Street, Old Town',
    '{}'::jsonb
  )
  ON CONFLICT (id) DO NOTHING;

  -- (b) structured row with a stale free-text business_address
  INSERT INTO public.merchants (id, email, business_name, slug, business_address, registered_address)
  VALUES (
    '8f0ed783-0000-4000-8000-0000000003f4',
    'structured-backfill@example.com',
    'Structured Backfill Store',
    'structured-backfill-store',
    'STALE 1 Old Road',
    jsonb_build_object('street', '15 Broad Street', 'city', 'Lagos', 'state', 'Lagos')
  )
  ON CONFLICT (id) DO NOTHING;

  ALTER TABLE public.merchants ENABLE TRIGGER zz_sync_business_address_from_registered;

  -- Replay the migration's back-fill statement verbatim.
  UPDATE public.merchants
  SET business_address = public.format_merchant_address(registered_address)
  WHERE registered_address IS NOT NULL
    AND registered_address <> '{}'::jsonb
    AND public.format_merchant_address(registered_address) IS NOT NULL
    AND business_address IS DISTINCT FROM public.format_merchant_address(registered_address);

  SELECT business_address INTO preserved
  FROM public.merchants WHERE id = '8f0ed783-0000-4000-8000-0000000003f3';
  IF preserved IS DISTINCT FROM '99 Legacy Street, Old Town' THEN
    RAISE EXCEPTION 'back-fill wiped a free-text-only address (data loss), got: %', COALESCE(preserved, '<null>');
  END IF;

  SELECT business_address INTO derived
  FROM public.merchants WHERE id = '8f0ed783-0000-4000-8000-0000000003f4';
  IF derived IS DISTINCT FROM '15 Broad Street, Lagos, Lagos' THEN
    RAISE EXCEPTION 'back-fill did not derive structured address, got: %', COALESCE(derived, '<null>');
  END IF;

  RAISE NOTICE 'OK: back-fill preserves free-text-only addresses and derives structured ones';
END;
$$ LANGUAGE plpgsql;

-- 3. Legacy direct free-text writes remain harmless while structured input is absent.
DO $$
DECLARE
  preserved text;
BEGIN
  INSERT INTO public.merchants (id, email, business_name, slug, business_address, registered_address)
  VALUES (
    '8f0ed783-0000-4000-8000-0000000003f5',
    'legacy-direct-write@example.com',
    'Legacy Direct Store',
    'legacy-direct-store',
    E'  12 Legacy Road, Old Town\t',
    '{}'::jsonb
  )
  ON CONFLICT (id) DO NOTHING;

  SELECT business_address INTO preserved
  FROM public.merchants WHERE id = '8f0ed783-0000-4000-8000-0000000003f5';
  IF preserved IS DISTINCT FROM '12 Legacy Road, Old Town' THEN
    RAISE EXCEPTION 'insert wiped or failed to trim legacy direct address, got: %', COALESCE(preserved, '<null>');
  END IF;

  UPDATE public.merchants
  SET business_address = E'  14 Legacy Road, New Town\n'
  WHERE id = '8f0ed783-0000-4000-8000-0000000003f5';

  SELECT business_address INTO preserved
  FROM public.merchants WHERE id = '8f0ed783-0000-4000-8000-0000000003f5';
  IF preserved IS DISTINCT FROM '14 Legacy Road, New Town' THEN
    RAISE EXCEPTION 'direct update wiped or failed to trim legacy address, got: %', COALESCE(preserved, '<null>');
  END IF;

  RAISE NOTICE 'OK: legacy direct business_address writes are preserved while registered_address is empty';
END;
$$ LANGUAGE plpgsql;

ROLLBACK;
