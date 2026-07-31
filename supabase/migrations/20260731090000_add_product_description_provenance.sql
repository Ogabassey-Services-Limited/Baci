-- Boundary C1: additive product-description provenance and merchant-attested
-- full-replacement grants. Runtime writers/consumers are added in later C2/C3
-- slices; C1 never changes existing product text or legacy NULL provenance.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS description_digital_source_type text,
  ADD COLUMN IF NOT EXISTS description_provenance_sha256 text,
  ADD CONSTRAINT products_description_digital_source_type_check
    CHECK (
      description_digital_source_type IS NULL
      OR description_digital_source_type IN (
        'unknown',
        'default',
        'trained_algorithmic_media'
      )
    ),
  ADD CONSTRAINT products_description_provenance_sha256_check
    CHECK (
      description_provenance_sha256 IS NULL
      OR description_provenance_sha256 ~ '^[0-9a-f]{64}$'
    );

COMMENT ON COLUMN public.products.description_digital_source_type IS
  'C1 additive provenance classification. Legacy rows remain NULL until an exact reviewed reconciliation.';
COMMENT ON COLUMN public.products.description_provenance_sha256 IS
  'C1 additive SHA-256 of exact UTF-8 description bytes. Legacy rows remain NULL until an exact reviewed reconciliation.';

CREATE TABLE IF NOT EXISTS private.product_description_attestation_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  operation_id uuid NOT NULL UNIQUE,
  expected_old_description text,
  expected_old_source_type text,
  expected_old_sha256 text,
  proposed_description_sha256 text NOT NULL,
  full_replacement boolean NOT NULL,
  purpose text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  CONSTRAINT product_description_attestation_grants_expected_source_check CHECK (
    expected_old_source_type IS NULL
    OR expected_old_source_type IN (
      'unknown',
      'default',
      'trained_algorithmic_media'
    )
  ),
  CONSTRAINT product_description_attestation_grants_expected_hash_check CHECK (
    expected_old_sha256 IS NULL
    OR expected_old_sha256 ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT product_description_attestation_grants_proposed_hash_check CHECK (
    proposed_description_sha256 ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT product_description_attestation_grants_purpose_check CHECK (
    purpose ~ '^[a-z][a-z0-9_]{2,63}$'
  ),
  CONSTRAINT product_description_attestation_grants_expiry_check CHECK (
    expires_at > created_at
  ),
  CONSTRAINT product_description_attestation_grants_consumed_check CHECK (
    consumed_at IS NULL OR consumed_at >= created_at
  )
);

ALTER TABLE private.product_description_attestation_grants ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE private.product_description_attestation_grants
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.request_product_description_attestation_grant(
  p_merchant_id uuid,
  p_product_id uuid,
  p_operation_id uuid,
  p_expected_old_description text,
  p_expected_old_source_type text,
  p_expected_old_sha256 text,
  p_proposed_description_sha256 text,
  p_full_replacement boolean,
  p_purpose text
)
RETURNS TABLE(grant_id uuid, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_product_merchant_id uuid;
  v_product_description text;
  v_product_source_type text;
  v_product_sha256 text;
  v_existing private.product_description_attestation_grants%ROWTYPE;
  v_expires_at timestamptz := pg_catalog.clock_timestamp() + interval '15 minutes';
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'product_description_attestation_unauthenticated';
  END IF;

  IF p_merchant_id IS NULL
    OR p_product_id IS NULL
    OR p_operation_id IS NULL
    OR p_proposed_description_sha256 IS NULL
    OR p_proposed_description_sha256 !~ '^[0-9a-f]{64}$'
    OR p_expected_old_sha256 IS NOT NULL
      AND p_expected_old_sha256 !~ '^[0-9a-f]{64}$'
    OR p_expected_old_source_type IS NOT NULL
      AND p_expected_old_source_type NOT IN (
        'unknown',
        'default',
        'trained_algorithmic_media'
      )
    OR p_full_replacement IS NULL
    OR p_purpose IS NULL
    OR p_purpose !~ '^[a-z][a-z0-9_]{2,63}$' THEN
    RAISE EXCEPTION 'product_description_attestation_invalid_binding';
  END IF;

  SELECT
    p.merchant_id,
    p.description,
    p.description_digital_source_type,
    p.description_provenance_sha256
  INTO
    v_product_merchant_id,
    v_product_description,
    v_product_source_type,
    v_product_sha256
  FROM public.products AS p
  WHERE p.id = p_product_id;

  IF FOUND THEN
    IF v_product_merchant_id IS DISTINCT FROM p_merchant_id THEN
      RAISE EXCEPTION 'product_description_attestation_product_merchant_mismatch';
    END IF;

    IF pg_catalog.convert_to(v_product_description, 'UTF8')
         IS DISTINCT FROM pg_catalog.convert_to(p_expected_old_description, 'UTF8')
      OR pg_catalog.convert_to(v_product_source_type, 'UTF8')
         IS DISTINCT FROM pg_catalog.convert_to(p_expected_old_source_type, 'UTF8')
      OR pg_catalog.convert_to(v_product_sha256, 'UTF8')
         IS DISTINCT FROM pg_catalog.convert_to(p_expected_old_sha256, 'UTF8') THEN
      RAISE EXCEPTION 'product_description_attestation_expected_old_mismatch';
    END IF;
  ELSIF p_expected_old_description IS NOT NULL
    OR p_expected_old_source_type IS NOT NULL
    OR p_expected_old_sha256 IS NOT NULL THEN
    RAISE EXCEPTION 'product_description_attestation_new_product_expected_old_mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.merchants AS merchant
    WHERE merchant.id = p_merchant_id
      AND merchant.user_id = v_actor_id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.staff_members AS staff
    WHERE staff.merchant_id = p_merchant_id
      AND staff.user_id = v_actor_id
      AND staff.status = 'active'
  ) THEN
    RAISE EXCEPTION 'product_description_attestation_merchant_authority_required';
  END IF;

  SELECT *
  INTO v_existing
  FROM private.product_description_attestation_grants AS attestation
  WHERE attestation.operation_id = p_operation_id;

  IF FOUND THEN
    IF v_existing.merchant_id IS DISTINCT FROM p_merchant_id
      OR v_existing.product_id IS DISTINCT FROM p_product_id
      OR v_existing.actor_id IS DISTINCT FROM v_actor_id
      OR pg_catalog.convert_to(v_existing.expected_old_description, 'UTF8')
           IS DISTINCT FROM pg_catalog.convert_to(p_expected_old_description, 'UTF8')
      OR pg_catalog.convert_to(v_existing.expected_old_source_type, 'UTF8')
           IS DISTINCT FROM pg_catalog.convert_to(p_expected_old_source_type, 'UTF8')
      OR pg_catalog.convert_to(v_existing.expected_old_sha256, 'UTF8')
           IS DISTINCT FROM pg_catalog.convert_to(p_expected_old_sha256, 'UTF8')
      OR pg_catalog.convert_to(v_existing.proposed_description_sha256, 'UTF8')
           IS DISTINCT FROM pg_catalog.convert_to(p_proposed_description_sha256, 'UTF8')
      OR v_existing.full_replacement IS DISTINCT FROM p_full_replacement
      OR pg_catalog.convert_to(v_existing.purpose, 'UTF8')
           IS DISTINCT FROM pg_catalog.convert_to(p_purpose, 'UTF8') THEN
      RAISE EXCEPTION 'product_description_attestation_operation_binding_mismatch';
    END IF;

    IF v_existing.consumed_at IS NOT NULL THEN
      RAISE EXCEPTION 'product_description_attestation_grant_consumed';
    END IF;

    IF v_existing.expires_at <= pg_catalog.clock_timestamp() THEN
      RAISE EXCEPTION 'product_description_attestation_grant_expired';
    END IF;

    RETURN QUERY SELECT v_existing.id, v_existing.expires_at;
    RETURN;
  END IF;

  INSERT INTO private.product_description_attestation_grants (
    merchant_id,
    product_id,
    actor_id,
    operation_id,
    expected_old_description,
    expected_old_source_type,
    expected_old_sha256,
    proposed_description_sha256,
    full_replacement,
    purpose,
    expires_at
  ) VALUES (
    p_merchant_id,
    p_product_id,
    v_actor_id,
    p_operation_id,
    p_expected_old_description,
    p_expected_old_source_type,
    p_expected_old_sha256,
    p_proposed_description_sha256,
    p_full_replacement,
    p_purpose,
    v_expires_at
  )
  RETURNING id, product_description_attestation_grants.expires_at
  INTO grant_id, expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.request_product_description_attestation_grant(
  uuid, uuid, uuid, text, text, text, text, boolean, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_product_description_attestation_grant(
  uuid, uuid, uuid, text, text, text, text, boolean, text
) TO authenticated;

COMMENT ON FUNCTION public.request_product_description_attestation_grant(
  uuid, uuid, uuid, text, text, text, text, boolean, text
) IS 'C1 authenticated merchant/staff-only, one-use exact-byte product-description attestation grant request. This is provenance evidence, not a privileged write or owner-approval edge.';
