-- Environment + role-scoped delete for the BYOK payment-credential vault.
--
-- The existing `delete_merchant_payment_credential(uuid, text)` wipes EVERY
-- role/environment for a provider — correct for a full disconnect, but wrong as
-- the rollback of a single failed save: a transient sandbox-save failure would
-- nuke an unrelated LIVE credential pair (payment-credentials:204). This
-- function deletes exactly one (merchant, provider, credential_role,
-- environment) slot so the save-rollback can scope to the two roles it just
-- wrote at the failed environment, leaving live checkout untouched.
--
-- service_role only, mirroring the sibling vault RPCs.

CREATE OR REPLACE FUNCTION public.delete_merchant_payment_credential_role(
  p_merchant_id uuid,
  p_provider text,
  p_credential_role text,
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

  IF p_credential_role IS NULL
     OR p_credential_role NOT IN ('client_id', 'secret_key', 'webhook_secret', 'connect_account_id', 'public_key') THEN
    RAISE EXCEPTION 'unsupported credential role' USING ERRCODE = '22023';
  END IF;

  IF p_environment IS NULL OR p_environment NOT IN ('test', 'live') THEN
    RAISE EXCEPTION 'unsupported credential environment' USING ERRCODE = '22023';
  END IF;

  DELETE FROM private.merchant_payment_credentials AS mpc
  WHERE mpc.merchant_id = p_merchant_id
    AND mpc.provider = p_provider
    AND mpc.credential_role = p_credential_role
    AND mpc.environment = p_environment;
END;
$$;

ALTER FUNCTION public.delete_merchant_payment_credential_role(uuid, text, text, text)
  OWNER TO postgres;

REVOKE ALL ON FUNCTION public.delete_merchant_payment_credential_role(uuid, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_merchant_payment_credential_role(uuid, text, text, text)
  TO service_role;

COMMENT ON FUNCTION public.delete_merchant_payment_credential_role(uuid, text, text, text) IS
  'Deletes ONE (merchant, provider, credential_role, environment) vault slot, e.g. to roll back a single failed save without touching other environments. service_role only.';
