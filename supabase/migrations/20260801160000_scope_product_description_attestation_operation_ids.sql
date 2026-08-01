-- Boundary C1 privacy follow-up: scope attestation operation UUIDs to the
-- authorized merchant. This preserves idempotency within a tenant without
-- exposing another tenant's operation existence through a SECURITY DEFINER RPC.

-- Operation UUIDs are idempotency keys within a merchant, not a global
-- namespace. Scoping the uniqueness constraint prevents a UUID used by one
-- merchant from becoming an existence oracle for another merchant while
-- retaining strict uniqueness for every merchant's own operations.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'private.product_description_attestation_grants'::regclass
      AND conname = 'pd_attestation_grants_merchant_operation_id_key'
  ) THEN
    ALTER TABLE private.product_description_attestation_grants
      ADD CONSTRAINT pd_attestation_grants_merchant_operation_id_key
      UNIQUE (merchant_id, operation_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'private.product_description_attestation_grant_evidence'::regclass
      AND conname = 'pd_attestation_evidence_merchant_operation_id_key'
  ) THEN
    ALTER TABLE private.product_description_attestation_grant_evidence
      ADD CONSTRAINT pd_attestation_evidence_merchant_operation_id_key
      UNIQUE (merchant_id, operation_id);
  END IF;

END;
$$;

