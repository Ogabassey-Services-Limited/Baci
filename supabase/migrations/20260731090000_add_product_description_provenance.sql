-- Boundary C1: additive product-description provenance and merchant-attested
-- full-replacement grants. Runtime writers/consumers are added in later C2/C3
-- slices; C1 never changes existing product text or legacy NULL provenance.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS description_digital_source_type text,
  ADD COLUMN IF NOT EXISTS description_provenance_sha256 text;

-- Keep the additive migration metadata-only. Validation is performed by the
-- ordered follow-up migration after the constraints are present, avoiding an
-- access-exclusive table scan during the main history replay. Guard each
-- constraint so a retry after out-of-band materialization is idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.products'::regclass
      AND conname = 'products_description_digital_source_type_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_description_digital_source_type_check
      CHECK (
        description_digital_source_type IS NULL
        OR description_digital_source_type IN (
          'unknown',
          'default',
          'trained_algorithmic_media'
        )
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.products'::regclass
      AND conname = 'products_description_provenance_sha256_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_description_provenance_sha256_check
      CHECK (
        description_provenance_sha256 IS NULL
        OR description_provenance_sha256 ~ '^[0-9a-f]{64}$'
      ) NOT VALID;
  END IF;
END;
$$;

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
