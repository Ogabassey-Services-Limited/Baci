-- BYOK payment provider credential vault.
-- Mirrors the private-schema plus SECURITY DEFINER RPC pattern already used
-- for quiz route-proof secrets: PostgREST (including the service-role client)
-- cannot select from a schema that is not exposed, so every read or write of
-- ciphertext must go through a public function granted to service_role only.

CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.merchant_payment_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  provider text NOT NULL
    CHECK (provider IN ('paypal', 'stripe', 'flutterwave', 'paystack', 'razorpay')),
  credential_role text NOT NULL
    CHECK (credential_role IN ('client_id', 'secret_key', 'webhook_secret', 'connect_account_id', 'public_key')),
  environment text NOT NULL DEFAULT 'live'
    CHECK (environment IN ('test', 'live')),
  ciphertext text NOT NULL,
  kek_version smallint NOT NULL DEFAULT 1,
  key_last4 text,
  is_active boolean NOT NULL DEFAULT true,
  last_validated_at timestamptz,
  last_validation_error text,
  disabled_at timestamptz,
  disabled_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, provider, credential_role, environment)
);

CREATE INDEX IF NOT EXISTS merchant_payment_credentials_merchant_id_idx
  ON private.merchant_payment_credentials (merchant_id);

ALTER TABLE private.merchant_payment_credentials ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE private.merchant_payment_credentials FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER handle_updated_at
  BEFORE UPDATE ON private.merchant_payment_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE private.merchant_payment_credentials IS
  'Merchant BYOK payment provider credential vault. Ciphertext is only reachable through public SECURITY DEFINER RPCs granted to service_role.';

-- ---------------------------------------------------------------------------
-- RPCs (all SECURITY DEFINER, empty search_path, service_role EXECUTE only).
-- Every function re-validates inputs against the same allow-lists as the
-- table CHECK constraints as defense in depth, even though only the trusted
-- backend (service_role) can ever call them.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_merchant_payment_credential(
  p_merchant_id uuid,
  p_provider text,
  p_credential_role text,
  p_environment text,
  p_ciphertext text,
  p_kek_version smallint,
  p_key_last4 text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
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

  IF p_ciphertext IS NULL OR pg_catalog.length(pg_catalog.btrim(p_ciphertext)) = 0 THEN
    RAISE EXCEPTION 'ciphertext is required' USING ERRCODE = '22023';
  END IF;

  IF p_kek_version IS NULL OR p_kek_version < 1 THEN
    RAISE EXCEPTION 'kek version must be a positive integer' USING ERRCODE = '22023';
  END IF;

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
    key_last4
  )
  VALUES (
    p_merchant_id,
    p_provider,
    p_credential_role,
    p_environment,
    p_ciphertext,
    p_kek_version,
    NULLIF(p_key_last4, '')
  )
  ON CONFLICT (merchant_id, provider, credential_role, environment)
  DO UPDATE SET
    ciphertext = EXCLUDED.ciphertext,
    kek_version = EXCLUDED.kek_version,
    key_last4 = EXCLUDED.key_last4,
    is_active = true,
    last_validation_error = NULL,
    disabled_at = NULL,
    disabled_reason = NULL,
    updated_at = pg_catalog.now()
  RETURNING mpc.id INTO v_id;

  RETURN v_id;
END;
$$;

ALTER FUNCTION public.set_merchant_payment_credential(
  uuid, text, text, text, text, smallint, text
) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.set_merchant_payment_credential(
  uuid, text, text, text, text, smallint, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_merchant_payment_credential(
  uuid, text, text, text, text, smallint, text
) TO service_role;

COMMENT ON FUNCTION public.set_merchant_payment_credential(
  uuid, text, text, text, text, smallint, text
) IS 'Upserts one merchant BYOK payment credential role and reactivates it. service_role only.';

CREATE OR REPLACE FUNCTION public.get_merchant_payment_credential_meta(
  p_merchant_id uuid,
  p_provider text
)
RETURNS TABLE (
  credential_role text,
  environment text,
  key_last4 text,
  is_active boolean,
  last_validated_at timestamptz,
  last_validation_error text,
  disabled_at timestamptz
)
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

  RETURN QUERY
  SELECT
    mpc.credential_role,
    mpc.environment,
    mpc.key_last4,
    mpc.is_active,
    mpc.last_validated_at,
    mpc.last_validation_error,
    mpc.disabled_at
  FROM private.merchant_payment_credentials AS mpc
  WHERE mpc.merchant_id = p_merchant_id
    AND mpc.provider = p_provider;
END;
$$;

ALTER FUNCTION public.get_merchant_payment_credential_meta(uuid, text) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.get_merchant_payment_credential_meta(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_merchant_payment_credential_meta(uuid, text)
  TO service_role;

COMMENT ON FUNCTION public.get_merchant_payment_credential_meta(uuid, text) IS
  'Returns redacted metadata (never ciphertext) for every credential role a merchant has stored for a provider. service_role only.';

CREATE OR REPLACE FUNCTION public.get_merchant_payment_credential_ciphertext(
  p_merchant_id uuid,
  p_provider text,
  p_credential_role text,
  p_environment text
)
RETURNS TABLE (
  ciphertext text,
  kek_version smallint
)
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

  -- Only an active row is ever returned; a disabled credential yields zero
  -- rows so the caller fails closed instead of decrypting a revoked secret.
  RETURN QUERY
  SELECT
    mpc.ciphertext,
    mpc.kek_version
  FROM private.merchant_payment_credentials AS mpc
  WHERE mpc.merchant_id = p_merchant_id
    AND mpc.provider = p_provider
    AND mpc.credential_role = p_credential_role
    AND mpc.environment = p_environment
    AND mpc.is_active = true;
END;
$$;

ALTER FUNCTION public.get_merchant_payment_credential_ciphertext(uuid, text, text, text)
  OWNER TO postgres;

REVOKE ALL ON FUNCTION public.get_merchant_payment_credential_ciphertext(uuid, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_merchant_payment_credential_ciphertext(uuid, text, text, text)
  TO service_role;

COMMENT ON FUNCTION public.get_merchant_payment_credential_ciphertext(uuid, text, text, text) IS
  'The only ciphertext read path for the payment credential vault. Returns zero rows for an inactive credential. service_role only.';

CREATE OR REPLACE FUNCTION public.mark_merchant_payment_credential_invalid(
  p_merchant_id uuid,
  p_provider text,
  p_credential_role text,
  p_environment text,
  p_error text
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

  UPDATE private.merchant_payment_credentials AS mpc
  SET
    is_active = false,
    disabled_at = pg_catalog.now(),
    disabled_reason = NULLIF(p_error, ''),
    last_validation_error = NULLIF(p_error, ''),
    updated_at = pg_catalog.now()
  WHERE mpc.merchant_id = p_merchant_id
    AND mpc.provider = p_provider
    AND mpc.credential_role = p_credential_role
    AND mpc.environment = p_environment;
END;
$$;

ALTER FUNCTION public.mark_merchant_payment_credential_invalid(uuid, text, text, text, text)
  OWNER TO postgres;

REVOKE ALL ON FUNCTION public.mark_merchant_payment_credential_invalid(uuid, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_merchant_payment_credential_invalid(uuid, text, text, text, text)
  TO service_role;

COMMENT ON FUNCTION public.mark_merchant_payment_credential_invalid(uuid, text, text, text, text) IS
  'Disables a merchant BYOK credential role after a failed validation or provider rejection. service_role only.';

CREATE OR REPLACE FUNCTION public.delete_merchant_payment_credential(
  p_merchant_id uuid,
  p_provider text
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

  DELETE FROM private.merchant_payment_credentials AS mpc
  WHERE mpc.merchant_id = p_merchant_id
    AND mpc.provider = p_provider;
END;
$$;

ALTER FUNCTION public.delete_merchant_payment_credential(uuid, text) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.delete_merchant_payment_credential(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_merchant_payment_credential(uuid, text)
  TO service_role;

COMMENT ON FUNCTION public.delete_merchant_payment_credential(uuid, text) IS
  'Deletes every stored credential role for a merchant + provider pair, e.g. on disconnect. service_role only.';

CREATE OR REPLACE FUNCTION public.touch_merchant_payment_credential_validated(
  p_merchant_id uuid,
  p_provider text
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

  UPDATE private.merchant_payment_credentials AS mpc
  SET
    last_validated_at = pg_catalog.now(),
    last_validation_error = NULL,
    updated_at = pg_catalog.now()
  WHERE mpc.merchant_id = p_merchant_id
    AND mpc.provider = p_provider;
END;
$$;

ALTER FUNCTION public.touch_merchant_payment_credential_validated(uuid, text)
  OWNER TO postgres;

REVOKE ALL ON FUNCTION public.touch_merchant_payment_credential_validated(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.touch_merchant_payment_credential_validated(uuid, text)
  TO service_role;

COMMENT ON FUNCTION public.touch_merchant_payment_credential_validated(uuid, text) IS
  'Records a successful provider validation timestamp and clears the last error for every role under a provider. service_role only.';
