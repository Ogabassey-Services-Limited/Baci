-- Scope credential validation timestamps to the environment that was actually
-- validated.
--
-- `touch_merchant_payment_credential_validated(merchant, provider)` stamped
-- `last_validated_at` on EVERY stored row for the provider, across both
-- environments. So a merchant saving+validating SANDBOX credentials also marked
-- their (possibly stale, never-checked) LIVE row as validated — and readiness /
-- publish then treats live PayPal as good to go, only to fail at a real customer
-- checkout.
--
-- The OAuth check only ever exercises the submitted environment, so only that
-- environment may be stamped. The old 2-arg signature is dropped rather than
-- overloaded: leaving it callable would leave the bug reachable.

DROP FUNCTION IF EXISTS public.touch_merchant_payment_credential_validated(uuid, text);

CREATE OR REPLACE FUNCTION public.touch_merchant_payment_credential_validated(
  p_merchant_id uuid,
  p_provider text,
  p_environment text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'merchant id is required' USING ERRCODE = '22023';
  END IF;

  IF p_provider IS NULL
     OR p_provider NOT IN ('paypal', 'stripe', 'flutterwave', 'paystack', 'razorpay') THEN
    RAISE EXCEPTION 'unsupported payment provider' USING ERRCODE = '22023';
  END IF;

  -- Fail closed: without an explicit environment we would be back to stamping
  -- credentials nobody validated.
  IF p_environment IS NULL OR p_environment NOT IN ('test', 'live') THEN
    RAISE EXCEPTION 'unsupported credential environment' USING ERRCODE = '22023';
  END IF;

  UPDATE private.merchant_payment_credentials AS mpc
  SET
    last_validated_at = pg_catalog.now(),
    last_validation_error = NULL,
    updated_at = pg_catalog.now()
  WHERE mpc.merchant_id = p_merchant_id
    AND mpc.provider = p_provider
    AND mpc.environment = p_environment;
END;
$$;

REVOKE ALL ON FUNCTION public.touch_merchant_payment_credential_validated(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.touch_merchant_payment_credential_validated(uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.touch_merchant_payment_credential_validated(uuid, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.touch_merchant_payment_credential_validated(uuid, text, text) TO service_role;
