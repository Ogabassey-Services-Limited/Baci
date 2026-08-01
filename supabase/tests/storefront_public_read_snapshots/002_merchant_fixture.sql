-- Merchant/domain fixtures for public storefront snapshot assertions.

DO $setup$
BEGIN
  INSERT INTO public.merchants (
    id,
    email,
    business_name,
    slug,
    is_published,
    paystack_subaccount_code,
    plan_tier,
    premium_features
  ) VALUES (
    '4d19ab10-0000-4000-8000-000000000001'::uuid,
    'storefront-snapshot-test@example.com',
    'Storefront Snapshot Test',
    'storefront-snapshot-test',
    true,
    'ACCT_PUBLIC_TEST',
    'business',
    '["private-feature"]'::jsonb
  );

  INSERT INTO public.merchant_feature_settings (
    merchant_id,
    blog_enabled,
    paystack_enabled,
    custom_settings
  )
  VALUES (
    '4d19ab10-0000-4000-8000-000000000001'::uuid,
    true,
    true,
    '{"google_merchant_id":"public-merchant-id","draft_secret":"must-not-cross-public-rpc"}'::jsonb
  )
  ON CONFLICT (merchant_id) DO UPDATE
  SET
    blog_enabled = EXCLUDED.blog_enabled,
    paystack_enabled = EXCLUDED.paystack_enabled,
    custom_settings = EXCLUDED.custom_settings;

  INSERT INTO public.merchants (
    id,
    email,
    business_name,
    slug,
    is_published,
    paystack_subaccount_code,
    plan_tier,
    premium_features,
    published_config,
    pages
  ) VALUES (
    '4d19ab10-0000-4000-8000-000000000012'::uuid,
    'storefront-unpublished-snapshot-test@example.com',
    'Unpublished Snapshot Test',
    'storefront-unpublished-snapshot-test',
    false,
    'ACCT_PRIVATE_DRAFT',
    'business',
    '["private-feature"]'::jsonb,
    '{"draft":"private"}'::jsonb,
    '{"about":"private draft page"}'::jsonb
  );

  INSERT INTO public.merchant_feature_settings (
    merchant_id,
    blog_enabled,
    custom_settings
  ) VALUES (
    '4d19ab10-0000-4000-8000-000000000012'::uuid,
    true,
    '{"draft_secret":"must-not-cross-public-rpc"}'::jsonb
  )
  ON CONFLICT (merchant_id) DO UPDATE
  SET
    blog_enabled = EXCLUDED.blog_enabled,
    custom_settings = EXCLUDED.custom_settings;

  -- Published merchant WITHOUT a merchant_feature_settings row: the public
  -- snapshot must return NULL feature_settings so the app normalizer applies
  -- its public defaults, while derived capability hints stay on merchant_data.
  INSERT INTO public.merchants (
    id,
    email,
    business_name,
    slug,
    is_published
  ) VALUES (
    '4d19ab10-0000-4000-8000-000000000018'::uuid,
    'storefront-nosettings-snapshot-test@example.com',
    'No Settings Snapshot Test',
    'storefront-nosettings-snapshot-test',
    true
  );

  -- trigger_create_merchant_feature_settings auto-creates a settings row on
  -- merchant insert; remove it to model a legacy merchant without one.
  DELETE FROM public.merchant_feature_settings
  WHERE merchant_id = '4d19ab10-0000-4000-8000-000000000018'::uuid;

  INSERT INTO public.domains (
    merchant_id,
    domain,
    domain_type,
    status,
    is_primary
  ) VALUES (
    '4d19ab10-0000-4000-8000-000000000001'::uuid,
    '  SNAPSHOT-TEST.USEBACI.COM  ',
    'subdomain',
    'active',
    true
  );

  INSERT INTO public.domains (
    merchant_id,
    domain,
    domain_type,
    status,
    is_primary
  ) VALUES (
    '4d19ab10-0000-4000-8000-000000000012'::uuid,
    'unpublished-snapshot-test.usebaci.com',
    'subdomain',
    'active',
    true
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.domains AS domain_row
    WHERE domain_row.merchant_id = '4d19ab10-0000-4000-8000-000000000001'::uuid
      AND domain_row.domain = 'snapshot-test.usebaci.com'
  ) THEN
    RAISE EXCEPTION 'domain write trigger did not normalize the hostname';
  END IF;

  BEGIN
    INSERT INTO public.domains (
      merchant_id,
      domain,
      domain_type,
      status,
      is_primary
    ) VALUES (
      '4d19ab10-0000-4000-8000-000000000001'::uuid,
      'snapshot-test.usebaci.com',
      'subdomain',
      'active',
      false
    );

    RAISE EXCEPTION 'duplicate normalized active domain unexpectedly inserted';
  EXCEPTION
    WHEN unique_violation THEN NULL;
  END;
END;
$setup$;
