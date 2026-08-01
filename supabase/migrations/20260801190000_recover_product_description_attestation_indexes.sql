-- disable-transaction

-- Recover invalid concurrent indexes left behind by an interrupted build.
-- CREATE INDEX CONCURRENTLY ... IF NOT EXISTS treats an invalid same-named
-- index as present, so remove only invalid targets before retrying the build.

DO $$
BEGIN
  IF to_regclass('private.product_description_attestation_grants_merchant_created_idx') IS NOT NULL
    AND to_regclass('private.pd_attestation_grants_merchant_created_idx') IS NULL THEN
    ALTER INDEX private.product_description_attestation_grants_merchant_created_idx
      RENAME TO pd_attestation_grants_merchant_created_idx;
  END IF;

  IF to_regclass('private.product_description_attestation_grant_evidence_merchant_created') IS NOT NULL
    AND to_regclass('private.pd_attestation_evidence_merchant_created_idx') IS NULL THEN
    ALTER INDEX private.product_description_attestation_grant_evidence_merchant_created
      RENAME TO pd_attestation_evidence_merchant_created_idx;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS index_class
    JOIN pg_catalog.pg_namespace AS index_namespace
      ON index_namespace.oid = index_class.relnamespace
    JOIN pg_catalog.pg_index AS index_state
      ON index_state.indexrelid = index_class.oid
    WHERE index_namespace.nspname = 'private'
      AND index_class.relname = 'pd_attestation_grants_merchant_created_idx'
      AND NOT index_state.indisvalid
  ) THEN
    DROP INDEX IF EXISTS private.pd_attestation_grants_merchant_created_idx;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS index_class
    JOIN pg_catalog.pg_namespace AS index_namespace
      ON index_namespace.oid = index_class.relnamespace
    JOIN pg_catalog.pg_index AS index_state
      ON index_state.indexrelid = index_class.oid
    WHERE index_namespace.nspname = 'private'
      AND index_class.relname = 'pd_attestation_evidence_merchant_created_idx'
      AND NOT index_state.indisvalid
  ) THEN
    DROP INDEX IF EXISTS private.pd_attestation_evidence_merchant_created_idx;
  END IF;
END;
$$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS pd_attestation_grants_merchant_created_idx
  ON private.product_description_attestation_grants (merchant_id, created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS pd_attestation_evidence_merchant_created_idx
  ON private.product_description_attestation_grant_evidence (merchant_id, created_at);
