-- Boundary C1 abuse-control follow-up: keep rolling-window indexes explicit,
-- short enough for PostgreSQL's 63-byte identifier limit, and tenant-scoped.

DO $$
BEGIN
  IF to_regclass('private.product_description_attestation_grant_evidence_merchant_created') IS NOT NULL
    AND to_regclass('private.pd_attestation_evidence_merchant_created_idx') IS NULL THEN
    ALTER INDEX private.product_description_attestation_grant_evidence_merchant_created
      RENAME TO pd_attestation_evidence_merchant_created_idx;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS pd_attestation_grants_merchant_created_idx
  ON private.product_description_attestation_grants (merchant_id, created_at);

CREATE INDEX IF NOT EXISTS pd_attestation_evidence_merchant_created_idx
  ON private.product_description_attestation_grant_evidence (merchant_id, created_at);
