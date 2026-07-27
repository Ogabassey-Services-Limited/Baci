-- Cross-tenant membership evidence is readable only by an authenticated
-- platform administrator. The archive remains immutable to every API role.
BEGIN;

INSERT INTO public.merchants (
  id,
  user_id,
  email,
  business_name,
  slug,
  is_platform_admin
) VALUES
  (
    'f3100000-0000-4000-8000-000000000001',
    'f3000000-0000-4000-8000-000000000001',
    'round8-admin@example.com',
    'Round Eight Admin',
    'round-eight-admin',
    true
  ),
  (
    'f3100000-0000-4000-8000-000000000002',
    'f3000000-0000-4000-8000-000000000002',
    'round8-merchant@example.com',
    'Round Eight Merchant',
    'round-eight-merchant',
    false
  );

SELECT set_config(
  'request.jwt.claim.sub',
  'f3000000-0000-4000-8000-000000000001',
  true
);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF (
    SELECT count(*)
    FROM public.product_category_cross_tenant_archive
  ) <> 1 THEN
    RAISE EXCEPTION
      'authenticated platform admin must read archived incident evidence';
  END IF;

  BEGIN
    INSERT INTO public.product_category_cross_tenant_archive (
      membership_id,
      product_id,
      category_id,
      product_merchant_id,
      category_merchant_id
    ) VALUES (
      gen_random_uuid(),
      gen_random_uuid(),
      gen_random_uuid(),
      gen_random_uuid(),
      gen_random_uuid()
    );
    RAISE EXCEPTION 'platform admin must not insert archive rows';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    UPDATE public.product_category_cross_tenant_archive
    SET archived_at = archived_at
    WHERE membership_id = 'a4000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'platform admin must not update archive rows';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    DELETE FROM public.product_category_cross_tenant_archive
    WHERE membership_id = 'a4000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'platform admin must not delete archive rows';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;
RESET ROLE;

SELECT set_config(
  'request.jwt.claim.sub',
  'f3000000-0000-4000-8000-000000000002',
  true
);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.product_category_cross_tenant_archive
  ) THEN
    RAISE EXCEPTION 'ordinary authenticated merchant must not read the archive';
  END IF;
END;
$$;
RESET ROLE;

SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM 1 FROM public.product_category_cross_tenant_archive;
    RAISE EXCEPTION 'anonymous role must not read the archive';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;
RESET ROLE;

SET LOCAL ROLE service_role;
DO $$
BEGIN
  BEGIN
    PERFORM 1 FROM public.product_category_cross_tenant_archive;
    RAISE EXCEPTION 'service role must not inherit archive read authority';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;
RESET ROLE;

ROLLBACK;
