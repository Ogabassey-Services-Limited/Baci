-- Atomically replaces the client-id/secret-key pair for one BYOK provider
-- environment. Both ciphertexts are produced in the app, then committed in one
-- database transaction under a pair-level advisory lock. Concurrent saves for
-- the same merchant/provider/environment cannot interleave or roll one another
-- back, and a failed statement leaves the previous pair intact.

CREATE OR REPLACE FUNCTION public.replace_merchant_payment_credential_pair(
  p_merchant_id uuid,
  p_provider text,
  p_environment text,
  p_client_id_ciphertext text,
  p_client_id_kek_version smallint,
  p_client_id_last4 text,
  p_secret_key_ciphertext text,
  p_secret_key_kek_version smallint,
  p_secret_key_last4 text
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

  -- Intentionally mirrors the vault table CHECK and the established single-role
  -- RPCs as defense in depth. This service-role function keeps the stable 22023
  -- contract instead of exposing a table-specific CHECK violation to callers.
  IF p_provider IS NULL
     OR p_provider NOT IN ('paypal', 'stripe', 'flutterwave', 'paystack', 'razorpay') THEN
    RAISE EXCEPTION 'unsupported payment provider' USING ERRCODE = '22023';
  END IF;

  IF p_environment IS NULL OR p_environment NOT IN ('test', 'live') THEN
    RAISE EXCEPTION 'unsupported credential environment' USING ERRCODE = '22023';
  END IF;

  IF p_client_id_ciphertext IS NULL
     OR pg_catalog.length(pg_catalog.btrim(p_client_id_ciphertext)) = 0
     OR p_secret_key_ciphertext IS NULL
     OR pg_catalog.length(pg_catalog.btrim(p_secret_key_ciphertext)) = 0 THEN
    RAISE EXCEPTION 'both credential ciphertexts are required' USING ERRCODE = '22023';
  END IF;

  IF p_client_id_kek_version IS NULL
     OR p_client_id_kek_version < 1
     OR p_secret_key_kek_version IS NULL
     OR p_secret_key_kek_version < 1 THEN
    RAISE EXCEPTION 'kek versions must be positive integers' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_merchant_id::text || ':' || p_provider || ':' || p_environment,
      0
    )
  );

  IF NOT EXISTS (SELECT 1 FROM public.merchants WHERE id = p_merchant_id) THEN
    RAISE EXCEPTION 'merchant not found' USING ERRCODE = '22023';
  END IF;

  INSERT INTO private.merchant_payment_credentials AS mpc (
    merchant_id,
    provider,
    credential_role,
    environment,
    ciphertext,
    kek_version,
    key_last4,
    is_active,
    last_validated_at,
    last_validation_error,
    disabled_at,
    disabled_reason
  )
  VALUES
    (
      p_merchant_id,
      p_provider,
      'client_id',
      p_environment,
      p_client_id_ciphertext,
      p_client_id_kek_version,
      NULLIF(p_client_id_last4, ''),
      true,
      pg_catalog.now(),
      NULL,
      NULL,
      NULL
    ),
    (
      p_merchant_id,
      p_provider,
      'secret_key',
      p_environment,
      p_secret_key_ciphertext,
      p_secret_key_kek_version,
      NULLIF(p_secret_key_last4, ''),
      true,
      pg_catalog.now(),
      NULL,
      NULL,
      NULL
    )
  ON CONFLICT (merchant_id, provider, credential_role, environment)
  DO UPDATE SET
    ciphertext = EXCLUDED.ciphertext,
    kek_version = EXCLUDED.kek_version,
    key_last4 = EXCLUDED.key_last4,
    is_active = true,
    last_validated_at = pg_catalog.now(),
    last_validation_error = NULL,
    disabled_at = NULL,
    disabled_reason = NULL,
    updated_at = pg_catalog.now();
END;
$$;

ALTER FUNCTION public.replace_merchant_payment_credential_pair(
  uuid, text, text, text, smallint, text, text, smallint, text
) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.replace_merchant_payment_credential_pair(
  uuid, text, text, text, smallint, text, text, smallint, text
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.replace_merchant_payment_credential_pair(
  uuid, text, text, text, smallint, text, text, smallint, text
) FROM anon;

REVOKE ALL ON FUNCTION public.replace_merchant_payment_credential_pair(
  uuid, text, text, text, smallint, text, text, smallint, text
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.replace_merchant_payment_credential_pair(
  uuid, text, text, text, smallint, text, text, smallint, text
) TO service_role;

COMMENT ON FUNCTION public.replace_merchant_payment_credential_pair(
  uuid, text, text, text, smallint, text, text, smallint, text
) IS 'Atomically replaces a merchant BYOK client-id/secret-key pair under a pair-level advisory lock. service_role only.';
