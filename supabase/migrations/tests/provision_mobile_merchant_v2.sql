\set ON_ERROR_STOP on

-- Collision, telemetry, and country regression coverage for mobile provisioning.
-- Fixtures are deterministic and rolled back.
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('9b2a0000-0000-4000-8000-000000000002', 'collision-owner@example.test'),
  ('9b2a0000-0000-4000-8000-000000000003', 'country-owner@example.test'),
  ('9b2a0000-0000-4000-8000-000000000008', 'automatic-owner@example.test'),
  ('9b2a0000-0000-4000-8000-000000000010', 'collision-tester@example.test');

INSERT INTO public.merchants (
  id, user_id, email, business_name, business_type, country,
  payout_currency, slug, signup_source
) VALUES (
  '9b2a1000-0000-4000-8000-000000000002',
  '9b2a0000-0000-4000-8000-000000000002',
  'collision-owner@example.test', 'Collision Owner', 'retail',
  'NG', 'NGN', 'live-mobile-slug', 'web'
);
INSERT INTO public.merchant_slug_aliases (old_slug, merchant_id)
VALUES (
  'retired-mobile-slug',
  '9b2a1000-0000-4000-8000-000000000002'
);
INSERT INTO public.domains (
  merchant_id, domain, tld, domain_type, status, is_primary
) VALUES (
  '9b2a1000-0000-4000-8000-000000000002',
  'domain-mobile-clash.usebaci.com', '.usebaci.com',
  'subdomain', 'active', true
);

-- Explicit collisions and format failures are stable and leave no owner row.
SELECT set_config(
  'request.jwt.claim.sub',
  '9b2a0000-0000-4000-8000-000000000010',
  true
);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"9b2a0000-0000-4000-8000-000000000010","email":"collision-tester@example.test","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
DO $test$
DECLARE
  v_case text;
  v_slug text;
  v_state text;
BEGIN
  FOREACH v_case IN ARRAY ARRAY[
    'live', 'retired', 'reserved', 'domain', 'invalid', 'too-long'
  ] LOOP
    v_slug := CASE v_case
      WHEN 'live' THEN 'live-mobile-slug'
      WHEN 'retired' THEN 'retired-mobile-slug'
      WHEN 'reserved' THEN 'admin'
      WHEN 'domain' THEN 'domain-mobile-clash'
      WHEN 'invalid' THEN 'Bad Slug'
      ELSE repeat('a', 64)
    END;
    BEGIN
      PERFORM public.provision_mobile_merchant_v2(
        'Collision', 'Tester', NULL, 'Collision Test', 'retail', NULL,
        'NG', v_slug, true, NULL, NULL, 'ios'
      );
      RAISE EXCEPTION 'explicit % slug was accepted', v_case;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
      IF v_case IN ('invalid', 'too-long') AND v_state <> 'PT400' THEN
        RAISE EXCEPTION '% mapped to %, expected PT400', v_case, v_state;
      ELSIF v_case NOT IN ('invalid', 'too-long') AND v_state <> 'PT409' THEN
        RAISE EXCEPTION '% mapped to %, expected PT409', v_case, v_state;
      END IF;
    END;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM public.merchants
    WHERE user_id = '9b2a0000-0000-4000-8000-000000000010'
  ) THEN
    RAISE EXCEPTION 'failed explicit collision leaked a merchant row';
  END IF;
END
$test$;

-- Invalid telemetry source writes nothing; an automatic live collision advances.
RESET ROLE;
SELECT set_config(
  'request.jwt.claim.sub',
  '9b2a0000-0000-4000-8000-000000000008',
  true
);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"9b2a0000-0000-4000-8000-000000000008","email":"automatic-owner@example.test","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
DO $test$
DECLARE
  v_result record;
BEGIN
  BEGIN
    PERFORM public.provision_mobile_merchant_v2(
      'Automatic', 'Owner', NULL, 'Live Mobile Slug', 'retail', NULL,
      'NG', NULL, false, NULL, NULL, 'web'
    );
    RAISE EXCEPTION 'invalid signup source was accepted';
  EXCEPTION WHEN sqlstate 'PT400' THEN NULL;
  END;
  SELECT * INTO v_result
  FROM public.provision_mobile_merchant_v2(
    'Automatic', 'Owner', NULL, 'Live Mobile Slug', 'retail', NULL,
    'NG', NULL, false, NULL, NULL, 'ios'
  );
  IF v_result.merchant_slug = 'live-mobile-slug'
     OR v_result.merchant_slug !~ '^live-mobile-slug-[0-9]+$' THEN
    RAISE EXCEPTION 'automatic collision did not advance: %',
      v_result.merchant_slug;
  END IF;
END
$test$;

RESET ROLE;
SELECT set_config(
  'request.jwt.claim.sub',
  '9b2a0000-0000-4000-8000-000000000003',
  true
);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"9b2a0000-0000-4000-8000-000000000003","email":"country-owner@example.test","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;
DO $test$
DECLARE
  v_pair record;
  v_result record;
  v_actual text;
BEGIN
  FOR v_pair IN
    SELECT * FROM (VALUES
      ('US','USD'), ('NG','NGN'), ('GB','GBP'), ('CA','CAD'),
      ('AU','AUD'), ('DE','EUR'), ('FR','EUR'), ('JP','JPY'),
      ('IN','INR'), ('BR','BRL'), ('ZA','ZAR'), ('AE','AED'),
      ('KE','KES'), ('GH','GHS'), ('EG','EGP'), ('CM','XAF'),
      ('CI','XOF'), ('SN','XOF'), ('BF','XOF'), ('RW','RWF'),
      ('TZ','TZS'), ('UG','UGX')
    ) AS pairs(country, currency)
  LOOP
    SELECT * INTO v_result
    FROM public.provision_mobile_merchant_v2(
      'Country', 'Tester', NULL, 'Country Test Store', 'retail', NULL,
      v_pair.country, NULL, false, NULL, NULL, 'android'
    );
    SELECT payout_currency INTO v_actual FROM public.merchants
    WHERE id = v_result.merchant_id;
    IF v_actual <> v_pair.currency THEN
      RAISE EXCEPTION 'country % persisted %, expected %',
        v_pair.country, v_actual, v_pair.currency;
    END IF;
  END LOOP;
  BEGIN
    PERFORM public.provision_mobile_merchant_v2(
      'Country', 'Tester', NULL, 'Country Test Store', 'retail', NULL,
      'ZZ', NULL, false, NULL, NULL, 'ios'
    );
    RAISE EXCEPTION 'unsupported country was accepted';
  EXCEPTION WHEN sqlstate 'PT400' THEN NULL;
  END;
END
$test$;

ROLLBACK;
