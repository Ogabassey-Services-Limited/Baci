-- =============================================
-- SECURITY TEST: merchant shipping zones, locations, and rates.
--   Proves the access rules for merchant-configured delivery:
--     (0) inserting a store auto-creates its rest-of-world fallback bucket;
--     (a) service_role can seed bucket + location + rate fixtures;
--     (b) an anonymous shopper cannot read the rate rows directly;
--     (c) an anonymous shopper CAN call get_storefront_shipping_rates and
--         receives the fixture rate with only checkout-safe fields;
--     (d) the partial unique index rejects a second rest-of-world bucket;
--     (e) the amount checks reject a negative base amount and an inverted
--         subtotal tier;
--     (f) the composite foreign key rejects a rate that references a different
--         store's bucket.
--     (g) the merchant-scoped no-overlap unique index rejects two zones both
--         claiming the same (country, subdivision), the trigger stamps a
--         location's merchant_id from its bucket, and country-wide vs a specific
--         subdivision may still layer.
--     (h) settings EDITORS can read the rows they edit: each SELECT policy
--         admits 'settings' -> 'view' OR 'settings' -> 'edit'
--         (20260710210000). Asserted by policy shape (pg_policy) because
--         check_staff_permission matches EXACT actions, so an edit-only role
--         that passed ensurePermission('settings','edit') would otherwise get
--         zero rows from the pre-write SELECTs. Modelling a JWT-authenticated
--         edit-only staff member is out of scope for this bare-psql fixture
--         (it seeds merchants with no auth.users rows); the migration
--         apply-test covers the runtime grant.
--     (i) the rest-of-world fallback bucket cannot be deleted through a direct
--         delete (the DB guard trigger rejects it), a normal bucket still
--         deletes, and a store-deletion cascade still cleans the fallback up
--         (20260710220000).
--     (j) the rest-of-world fallback bucket cannot be neutralized through an
--         UPDATE: unsetting is_rest_of_world or active is rejected by the guard
--         trigger, renaming it still succeeds, and a NON-fallback bucket may
--         still be deactivated freely (20260710230100).
--     (k) the rest-of-world fallback bucket cannot carry explicit location rows:
--         a direct INSERT of a location whose parent bucket is is_rest_of_world
--         is rejected by the guard trigger, while a location on a normal
--         (non-fallback) bucket still inserts (20260710240000).
--
-- USAGE:
--   psql $DATABASE_URL -f supabase/tests/merchant_shipping_rates_rls.sql
-- =============================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Arrange + positive/constraint assertions as the service role.
-- ---------------------------------------------------------------------------
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);

DO $$
DECLARE
  v_merchant_id uuid := 'a1b2c3d4-0000-4000-8000-000000000901';
  v_zone_id uuid := 'a1b2c3d4-0000-4000-8000-000000000902';
  v_location_id uuid := 'a1b2c3d4-0000-4000-8000-000000000903';
  v_rate_id uuid := 'a1b2c3d4-0000-4000-8000-000000000904';
  v_other_merchant_id uuid := 'a1b2c3d4-0000-4000-8000-000000000905';
  v_other_zone_id uuid := 'a1b2c3d4-0000-4000-8000-000000000906';
  v_count int;
  v_is_row boolean;
  v_raised boolean;
  v_bad_address jsonb;
BEGIN
  -- Seed a store. The after-insert hook should give it one fallback bucket.
  INSERT INTO public.merchants (id, email, business_name, slug, payout_currency)
  VALUES (
    v_merchant_id,
    'shipping-rls@example.com',
    'Shipping RLS Store',
    'shipping-rls-store',
    'NGN'
  );

  -- (0) The new-store hook created exactly one rest-of-world fallback bucket.
  SELECT count(*) INTO v_count
  FROM public.merchant_shipping_zones
  WHERE merchant_id = v_merchant_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION
      'new-store hook: expected 1 auto bucket, got %', v_count;
  END IF;

  SELECT is_rest_of_world INTO v_is_row
  FROM public.merchant_shipping_zones
  WHERE merchant_id = v_merchant_id;
  IF v_is_row IS DISTINCT FROM true THEN
    RAISE EXCEPTION
      'new-store hook: the auto bucket is not flagged rest-of-world';
  END IF;

  -- (a) A specific bucket + location + priced option seed cleanly.
  INSERT INTO public.merchant_shipping_zones (id, merchant_id, name, is_rest_of_world, active)
  VALUES (v_zone_id, v_merchant_id, 'Lagos', false, true);

  INSERT INTO public.merchant_shipping_zone_locations (id, zone_id, country_code, subdivision_code)
  VALUES (v_location_id, v_zone_id, 'NG', 'NG-LA');

  INSERT INTO public.merchant_shipping_rates (
    id, merchant_id, zone_id, name, kind, currency, base_amount,
    condition_type, delivery_min_days, delivery_max_days, sort_order, active
  )
  VALUES (
    v_rate_id, v_merchant_id, v_zone_id, 'Standard', 'ship', 'NGN', 1500,
    'always', 2, 4, 0, true
  );

  SELECT count(*) INTO v_count
  FROM public.merchant_shipping_rates
  WHERE merchant_id = v_merchant_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION
      'fixture seed: expected 1 rate row, got %', v_count;
  END IF;

  -- (d) A second rest-of-world bucket for the same store is rejected.
  v_raised := false;
  BEGIN
    INSERT INTO public.merchant_shipping_zones (merchant_id, name, is_rest_of_world, active)
    VALUES (v_merchant_id, 'Everywhere else duplicate', true, true);
  EXCEPTION WHEN unique_violation THEN
    v_raised := true;
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION
      'partial unique index allowed a second rest-of-world bucket';
  END IF;

  -- (e) A negative base amount is rejected by the amount check.
  v_raised := false;
  BEGIN
    INSERT INTO public.merchant_shipping_rates (
      merchant_id, zone_id, name, currency, base_amount
    )
    VALUES (v_merchant_id, v_zone_id, 'Negative', 'NGN', -1);
  EXCEPTION WHEN check_violation THEN
    v_raised := true;
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION
      'amount check allowed a negative base amount';
  END IF;

  -- (e) An inverted subtotal tier (max not above min) is rejected too.
  v_raised := false;
  BEGIN
    INSERT INTO public.merchant_shipping_rates (
      merchant_id, zone_id, name, currency, base_amount,
      condition_type, min_subtotal, max_subtotal
    )
    VALUES (
      v_merchant_id, v_zone_id, 'Bad tier', 'NGN', 100,
      'price_tier', 5000, 5000
    );
  EXCEPTION WHEN check_violation THEN
    v_raised := true;
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION
      'tier bounds check allowed max_subtotal not greater than min_subtotal';
  END IF;

  -- (f) A rate cannot point at another store's bucket. Seed a second store with
  -- its own bucket, then try to attach a rate for the first store to it: the
  -- composite (zone_id, merchant_id) foreign key must reject the cross-tenant
  -- reference.
  INSERT INTO public.merchants (id, email, business_name, slug, payout_currency)
  VALUES (
    v_other_merchant_id,
    'shipping-rls-other@example.com',
    'Shipping RLS Other Store',
    'shipping-rls-other-store',
    'NGN'
  );

  INSERT INTO public.merchant_shipping_zones (id, merchant_id, name, is_rest_of_world, active)
  VALUES (v_other_zone_id, v_other_merchant_id, 'Other Lagos', false, true);

  v_raised := false;
  BEGIN
    INSERT INTO public.merchant_shipping_rates (
      merchant_id, zone_id, name, currency, base_amount
    )
    VALUES (v_merchant_id, v_other_zone_id, 'Cross-tenant', 'NGN', 100);
  EXCEPTION WHEN foreign_key_violation THEN
    v_raised := true;
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION
      'composite foreign key allowed a rate referencing another store''s bucket';
  END IF;

  -- (h) A pickup rate with no pickup address is rejected. A settings.edit
  -- staffer could otherwise bypass the dashboard form via REST and create an
  -- active pickup rate with pickup_address = NULL, which checkout would offer
  -- with no collection point. The address-present check must reject it.
  v_raised := false;
  BEGIN
    INSERT INTO public.merchant_shipping_rates (
      merchant_id, zone_id, name, kind, currency, base_amount
    )
    VALUES (
      v_merchant_id, v_zone_id, 'Pickup no address', 'pickup', 'NGN', 0
    );
  EXCEPTION WHEN check_violation THEN
    v_raised := true;
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION
      'pickup address check allowed a pickup rate with a null pickup_address';
  END IF;

  -- (h) A pickup rate whose pickup_address carries only a blank address is
  -- rejected too (mirrors the form''s trim-then-non-empty rule).
  v_raised := false;
  BEGIN
    INSERT INTO public.merchant_shipping_rates (
      merchant_id, zone_id, name, kind, currency, base_amount, pickup_address
    )
    VALUES (
      v_merchant_id, v_zone_id, 'Pickup blank address', 'pickup', 'NGN', 0,
      jsonb_build_object('address', '   ')
    );
  EXCEPTION WHEN check_violation THEN
    v_raised := true;
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION
      'pickup address check allowed a pickup rate with a blank pickup_address';
  END IF;

  -- (h) A pickup rate whose pickup_address.address is a NON-STRING JSON value is
  -- rejected too. `->>'address'` coerces a number/bool/object to its text form
  -- (e.g. 123 -> "123"), so the length check ALONE would pass and re-open the
  -- REST bypass; the jsonb_typeof(...) = 'string' guard closes it. Each of a
  -- numeric, boolean, and object address must raise check_violation.
  FOR v_bad_address IN
    SELECT unnest(ARRAY[
      jsonb '{"address":123}',
      jsonb '{"address":true}',
      jsonb '{"address":{}}'
    ])
  LOOP
    v_raised := false;
    BEGIN
      INSERT INTO public.merchant_shipping_rates (
        merchant_id, zone_id, name, kind, currency, base_amount, pickup_address
      )
      VALUES (
        v_merchant_id, v_zone_id, 'Pickup non-string address', 'pickup', 'NGN',
        0, v_bad_address
      );
    EXCEPTION WHEN check_violation THEN
      v_raised := true;
    END;
    IF NOT v_raised THEN
      RAISE EXCEPTION
        'pickup address check allowed a non-string address value %',
        v_bad_address;
    END IF;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- (g) Cross-zone location overlap is enforced in the database, and the parent
-- bucket's owner is stamped onto each location automatically.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_merchant_id uuid := 'a1b2c3d4-0000-4000-8000-000000000901';
  v_location_id uuid := 'a1b2c3d4-0000-4000-8000-000000000903';
  v_second_zone_id uuid := 'a1b2c3d4-0000-4000-8000-000000000907';
  v_stamped_merchant_id uuid;
  v_raised boolean;
BEGIN
  -- The trigger stamped merchant_id on the earlier NG-LA location from its
  -- bucket, even though the fixture insert supplied no merchant_id.
  SELECT merchant_id INTO v_stamped_merchant_id
  FROM public.merchant_shipping_zone_locations
  WHERE id = v_location_id;
  IF v_stamped_merchant_id IS DISTINCT FROM v_merchant_id THEN
    RAISE EXCEPTION
      'overlap trigger: expected location merchant_id %, got %',
      v_merchant_id, v_stamped_merchant_id;
  END IF;

  -- A second bucket for the SAME store.
  INSERT INTO public.merchant_shipping_zones (id, merchant_id, name, is_rest_of_world, active)
  VALUES (v_second_zone_id, v_merchant_id, 'Lagos Duplicate', false, true);

  -- A second bucket cannot also claim NG-LA (the Lagos bucket already does):
  -- the merchant-scoped unique index rejects the cross-zone overlap.
  v_raised := false;
  BEGIN
    INSERT INTO public.merchant_shipping_zone_locations (zone_id, country_code, subdivision_code)
    VALUES (v_second_zone_id, 'NG', 'NG-LA');
  EXCEPTION WHEN unique_violation THEN
    v_raised := true;
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION
      'overlap index allowed two buckets to both claim NG-LA for one store';
  END IF;

  -- Country-wide NG layered over the specific NG-LA is still allowed
  -- (NULL subdivision differs from a value, so most-specific-wins holds).
  INSERT INTO public.merchant_shipping_zone_locations (zone_id, country_code, subdivision_code)
  VALUES (v_second_zone_id, 'NG', NULL);

  -- Restore the fixture to its pre-(g) shape (cascades this bucket's locations)
  -- so the later anon assertions that count this store's buckets stay accurate.
  DELETE FROM public.merchant_shipping_zones WHERE id = v_second_zone_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- (i) The rest-of-world fallback bucket cannot be deleted directly through any
-- path (the guard trigger rejects it), but a store-deletion cascade still
-- cleans it up. Uses a throwaway store so the earlier fixtures for store 901
-- stay intact.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_merchant_id uuid := 'a1b2c3d4-0000-4000-8000-000000000908';
  v_normal_zone_id uuid := 'a1b2c3d4-0000-4000-8000-000000000909';
  v_fallback_zone_id uuid;
  v_count int;
  v_raised boolean;
BEGIN
  -- Seed a throwaway store; the after-insert hook gives it one fallback bucket.
  INSERT INTO public.merchants (id, email, business_name, slug, payout_currency)
  VALUES (
    v_merchant_id,
    'shipping-rls-fallback@example.com',
    'Shipping RLS Fallback Store',
    'shipping-rls-fallback-store',
    'NGN'
  );

  SELECT id INTO v_fallback_zone_id
  FROM public.merchant_shipping_zones
  WHERE merchant_id = v_merchant_id
    AND is_rest_of_world;
  IF v_fallback_zone_id IS NULL THEN
    RAISE EXCEPTION
      'fallback guard: throwaway store has no auto fallback bucket to test';
  END IF;

  -- A direct delete of the fallback bucket is rejected by the guard trigger.
  v_raised := false;
  BEGIN
    DELETE FROM public.merchant_shipping_zones WHERE id = v_fallback_zone_id;
  EXCEPTION WHEN restrict_violation THEN
    v_raised := true;
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION
      'delete guard allowed the rest-of-world fallback bucket to be deleted directly';
  END IF;

  -- The fallback bucket survived the blocked delete.
  SELECT count(*) INTO v_count
  FROM public.merchant_shipping_zones
  WHERE id = v_fallback_zone_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION
      'delete guard did not preserve the fallback bucket (count %)', v_count;
  END IF;

  -- A normal (non-fallback) bucket still deletes freely.
  INSERT INTO public.merchant_shipping_zones (id, merchant_id, name, is_rest_of_world, active)
  VALUES (v_normal_zone_id, v_merchant_id, 'Deletable', false, true);

  DELETE FROM public.merchant_shipping_zones WHERE id = v_normal_zone_id;

  SELECT count(*) INTO v_count
  FROM public.merchant_shipping_zones
  WHERE id = v_normal_zone_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION
      'delete guard wrongly blocked a normal (non-fallback) bucket delete';
  END IF;

  -- Deleting the parent store still cascades away its zones, fallback included:
  -- the guard is a no-op once the parent merchant no longer exists.
  DELETE FROM public.merchants WHERE id = v_merchant_id;

  SELECT count(*) INTO v_count
  FROM public.merchant_shipping_zones
  WHERE merchant_id = v_merchant_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION
      'store-deletion cascade left % zone(s); the fallback guard blocked the cascade',
      v_count;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- (j) The rest-of-world fallback bucket cannot be neutralized through an
-- UPDATE: unsetting is_rest_of_world or active is rejected, renaming is still
-- allowed, and a normal (non-fallback) bucket may still be deactivated. Uses a
-- throwaway store so the store-901 fixtures stay intact.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_merchant_id uuid := 'a1b2c3d4-0000-4000-8000-000000000910';
  v_normal_zone_id uuid := 'a1b2c3d4-0000-4000-8000-000000000911';
  v_fallback_zone_id uuid;
  v_name text;
  v_active boolean;
  v_is_row boolean;
  v_raised boolean;
BEGIN
  -- Seed a throwaway store; the after-insert hook gives it one fallback bucket.
  INSERT INTO public.merchants (id, email, business_name, slug, payout_currency)
  VALUES (
    v_merchant_id,
    'shipping-rls-row-update@example.com',
    'Shipping RLS RoW Update Store',
    'shipping-rls-row-update-store',
    'NGN'
  );

  SELECT id INTO v_fallback_zone_id
  FROM public.merchant_shipping_zones
  WHERE merchant_id = v_merchant_id
    AND is_rest_of_world;
  IF v_fallback_zone_id IS NULL THEN
    RAISE EXCEPTION
      'update guard: throwaway store has no auto fallback bucket to test';
  END IF;

  -- Unsetting is_rest_of_world on the fallback is rejected by the guard.
  v_raised := false;
  BEGIN
    UPDATE public.merchant_shipping_zones
    SET is_rest_of_world = false
    WHERE id = v_fallback_zone_id;
  EXCEPTION WHEN restrict_violation THEN
    v_raised := true;
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION
      'update guard allowed the rest-of-world flag to be unset on the fallback bucket';
  END IF;

  -- Deactivating the fallback is rejected by the guard.
  v_raised := false;
  BEGIN
    UPDATE public.merchant_shipping_zones
    SET active = false
    WHERE id = v_fallback_zone_id;
  EXCEPTION WHEN restrict_violation THEN
    v_raised := true;
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION
      'update guard allowed the rest-of-world fallback bucket to be deactivated';
  END IF;

  -- The fallback survived both blocked updates unchanged.
  SELECT is_rest_of_world, active INTO v_is_row, v_active
  FROM public.merchant_shipping_zones
  WHERE id = v_fallback_zone_id;
  IF v_is_row IS DISTINCT FROM true THEN
    RAISE EXCEPTION
      'update guard did not preserve the fallback is_rest_of_world flag';
  END IF;
  IF v_active IS DISTINCT FROM true THEN
    RAISE EXCEPTION
      'update guard did not preserve the fallback active flag';
  END IF;

  -- Renaming the fallback is still allowed (name change touches no invariant).
  UPDATE public.merchant_shipping_zones
  SET name = 'Global fallback'
  WHERE id = v_fallback_zone_id;

  SELECT name INTO v_name
  FROM public.merchant_shipping_zones
  WHERE id = v_fallback_zone_id;
  IF v_name IS DISTINCT FROM 'Global fallback' THEN
    RAISE EXCEPTION
      'update guard wrongly blocked renaming the fallback bucket (name %)',
      v_name;
  END IF;

  -- A normal (non-fallback) bucket may still be deactivated freely.
  INSERT INTO public.merchant_shipping_zones (id, merchant_id, name, is_rest_of_world, active)
  VALUES (v_normal_zone_id, v_merchant_id, 'Deactivatable', false, true);

  UPDATE public.merchant_shipping_zones
  SET active = false
  WHERE id = v_normal_zone_id;

  SELECT active INTO v_active
  FROM public.merchant_shipping_zones
  WHERE id = v_normal_zone_id;
  IF v_active IS DISTINCT FROM false THEN
    RAISE EXCEPTION
      'update guard wrongly blocked deactivating a normal (non-fallback) bucket';
  END IF;

  -- Clean up the throwaway store (cascade removes its zones, fallback included).
  DELETE FROM public.merchants WHERE id = v_merchant_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- (k) The rest-of-world fallback bucket cannot carry explicit location rows: a
-- direct INSERT of a location onto the fallback bucket is rejected by the guard
-- trigger (it must stay the implicit catch-all), while a location on a normal
-- (non-fallback) bucket still inserts. Uses a throwaway store so the store-901
-- fixtures stay intact.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_merchant_id uuid := 'a1b2c3d4-0000-4000-8000-000000000912';
  v_normal_zone_id uuid := 'a1b2c3d4-0000-4000-8000-000000000913';
  v_fallback_zone_id uuid;
  v_count int;
  v_raised boolean;
BEGIN
  -- Seed a throwaway store; the after-insert hook gives it one fallback bucket.
  INSERT INTO public.merchants (id, email, business_name, slug, payout_currency)
  VALUES (
    v_merchant_id,
    'shipping-rls-row-location@example.com',
    'Shipping RLS RoW Location Store',
    'shipping-rls-row-location-store',
    'NGN'
  );

  SELECT id INTO v_fallback_zone_id
  FROM public.merchant_shipping_zones
  WHERE merchant_id = v_merchant_id
    AND is_rest_of_world;
  IF v_fallback_zone_id IS NULL THEN
    RAISE EXCEPTION
      'location guard: throwaway store has no auto fallback bucket to test';
  END IF;

  -- Attaching a location to the fallback bucket is rejected by the guard.
  v_raised := false;
  BEGIN
    INSERT INTO public.merchant_shipping_zone_locations (zone_id, country_code, subdivision_code)
    VALUES (v_fallback_zone_id, 'NG', 'NG-LA');
  EXCEPTION WHEN restrict_violation THEN
    v_raised := true;
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION
      'location guard allowed a location to be attached to the rest-of-world fallback bucket';
  END IF;

  -- No location row was created on the fallback bucket.
  SELECT count(*) INTO v_count
  FROM public.merchant_shipping_zone_locations
  WHERE zone_id = v_fallback_zone_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION
      'location guard left % location row(s) on the fallback bucket', v_count;
  END IF;

  -- A location on a normal (non-fallback) bucket still inserts freely.
  INSERT INTO public.merchant_shipping_zones (id, merchant_id, name, is_rest_of_world, active)
  VALUES (v_normal_zone_id, v_merchant_id, 'Lagos', false, true);

  INSERT INTO public.merchant_shipping_zone_locations (zone_id, country_code, subdivision_code)
  VALUES (v_normal_zone_id, 'NG', 'NG-LA');

  SELECT count(*) INTO v_count
  FROM public.merchant_shipping_zone_locations
  WHERE zone_id = v_normal_zone_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION
      'location guard wrongly blocked a location on a normal (non-fallback) bucket (count %)',
      v_count;
  END IF;

  -- Clean up the throwaway store (cascade removes its zones and locations).
  DELETE FROM public.merchants WHERE id = v_merchant_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- (h) Each shipping-settings SELECT policy admits 'settings' -> 'view' OR
-- 'settings' -> 'edit', so an edit-only staff role can read the rows it is
-- about to write (20260710210000). Proven by policy shape: the USING
-- expression must reference check_staff_permission, the settings resource, and
-- BOTH the view and edit actions.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_ok_count int;
BEGIN
  SELECT count(*) INTO v_ok_count
  FROM (
    VALUES
      (
        'public.merchant_shipping_zones'::regclass,
        'merchant_staff_select_shipping_zones'
      ),
      (
        'public.merchant_shipping_zone_locations'::regclass,
        'merchant_staff_select_shipping_zone_locations'
      ),
      (
        'public.merchant_shipping_rates'::regclass,
        'merchant_staff_select_shipping_rates'
      )
  ) AS expected(relid, polname)
  JOIN pg_policy AS p
    ON p.polrelid = expected.relid
    AND p.polname = expected.polname
    AND p.polcmd = 'r'
  WHERE pg_get_expr(p.polqual, p.polrelid) LIKE '%check_staff_permission%'
    AND pg_get_expr(p.polqual, p.polrelid) LIKE '%settings%'
    AND pg_get_expr(p.polqual, p.polrelid) LIKE '%''view''%'
    AND pg_get_expr(p.polqual, p.polrelid) LIKE '%''edit''%';

  IF v_ok_count <> 3 THEN
    RAISE EXCEPTION
      'expected all 3 shipping SELECT policies to admit settings view OR edit, matched %',
      v_ok_count;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Anonymous shopper assertions.
-- ---------------------------------------------------------------------------
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.role', 'anon', true);

-- (b) A direct read of the rate rows must not leak data: the anon role holds no
-- table grant, so this raises insufficient_privilege; if a future change grants
-- the table, the row-level rules must still yield zero rows. Either outcome is
-- acceptable; a non-empty read is a failure.
DO $$
DECLARE
  v_count int;
BEGIN
  BEGIN
    SELECT count(*) INTO v_count FROM public.merchant_shipping_rates;
  EXCEPTION WHEN insufficient_privilege THEN
    v_count := 0;
  END;
  IF v_count <> 0 THEN
    RAISE EXCEPTION
      'anonymous shopper read % rate rows directly; expected none', v_count;
  END IF;
END;
$$;

-- (c) The storefront routine returns the fixture safely for an anon shopper.
DO $$
DECLARE
  v_merchant_id uuid := 'a1b2c3d4-0000-4000-8000-000000000901';
  v_rate_id uuid := 'a1b2c3d4-0000-4000-8000-000000000904';
  v_result jsonb;
  v_rate jsonb;
BEGIN
  v_result := public.get_storefront_shipping_rates(v_merchant_id);

  -- Two active buckets are visible: the fallback plus the Lagos bucket.
  IF jsonb_array_length(v_result -> 'zones') <> 2 THEN
    RAISE EXCEPTION
      'storefront routine: expected 2 buckets, got %',
      jsonb_array_length(v_result -> 'zones');
  END IF;

  IF jsonb_array_length(v_result -> 'locations') <> 1 THEN
    RAISE EXCEPTION
      'storefront routine: expected 1 location, got %',
      jsonb_array_length(v_result -> 'locations');
  END IF;

  IF jsonb_array_length(v_result -> 'rates') <> 1 THEN
    RAISE EXCEPTION
      'storefront routine: expected 1 rate, got %',
      jsonb_array_length(v_result -> 'rates');
  END IF;

  v_rate := v_result -> 'rates' -> 0;

  IF (v_rate ->> 'id') IS DISTINCT FROM v_rate_id::text THEN
    RAISE EXCEPTION
      'storefront routine: unexpected rate id %', v_rate ->> 'id';
  END IF;

  IF (v_rate ->> 'currency') IS DISTINCT FROM 'NGN'
    OR (v_rate ->> 'base_amount')::numeric IS DISTINCT FROM 1500 THEN
    RAISE EXCEPTION
      'storefront routine: unexpected rate money fields (% / %)',
      v_rate ->> 'currency', v_rate ->> 'base_amount';
  END IF;

  -- The safe contract must not leak internal columns.
  IF v_rate ? 'merchant_id'
    OR v_rate ? 'active'
    OR v_rate ? 'created_at'
    OR v_rate ? 'updated_at' THEN
    RAISE EXCEPTION
      'storefront routine leaked an internal field in a rate object';
  END IF;
END;
$$;

RESET ROLE;

ROLLBACK;
