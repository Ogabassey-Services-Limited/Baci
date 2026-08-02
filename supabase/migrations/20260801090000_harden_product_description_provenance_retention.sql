-- C1 operational hardening: validate the additive provenance checks after the
-- columns and NOT VALID constraints have landed, index attestation lookups,
-- and bound the short-lived grant table with a service-role retention sweep.

ALTER TABLE public.products
  VALIDATE CONSTRAINT products_description_digital_source_type_check;

ALTER TABLE public.products
  VALIDATE CONSTRAINT products_description_provenance_sha256_check;

CREATE INDEX IF NOT EXISTS product_description_attestation_grants_merchant_id_idx
  ON private.product_description_attestation_grants (merchant_id);

CREATE INDEX IF NOT EXISTS product_description_attestation_grants_actor_id_idx
  ON private.product_description_attestation_grants (actor_id);

CREATE INDEX IF NOT EXISTS product_description_attestation_grants_expiry_idx
  ON private.product_description_attestation_grants (expires_at);

CREATE INDEX IF NOT EXISTS product_description_attestation_grants_consumed_idx
  ON private.product_description_attestation_grants (consumed_at)
  WHERE consumed_at IS NOT NULL;

ALTER TABLE private.product_description_attestation_grants OWNER TO postgres;

-- Terminal grants are audit evidence, not disposable cache rows. Keep a
-- detached archive so product, merchant, or user lifecycle changes cannot
-- make the exact actor/byte binding disappear when the active grant row is
-- reclaimed.
CREATE TABLE IF NOT EXISTS private.product_description_attestation_grant_evidence (
  id uuid PRIMARY KEY,
  merchant_id uuid NOT NULL,
  product_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  operation_id uuid NOT NULL UNIQUE,
  expected_old_description text,
  expected_old_source_type text,
  expected_old_sha256 text,
  proposed_description_sha256 text NOT NULL,
  full_replacement boolean NOT NULL,
  purpose text NOT NULL,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  archived_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp()
);

ALTER TABLE private.product_description_attestation_grant_evidence
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE private.product_description_attestation_grant_evidence
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE private.product_description_attestation_grant_evidence
  TO service_role;

CREATE INDEX IF NOT EXISTS product_description_attestation_grant_evidence_merchant_id_idx
  ON private.product_description_attestation_grant_evidence (merchant_id);

CREATE INDEX IF NOT EXISTS product_description_attestation_grant_evidence_actor_id_idx
  ON private.product_description_attestation_grant_evidence (actor_id);

CREATE INDEX IF NOT EXISTS product_description_attestation_grant_evidence_archived_at_idx
  ON private.product_description_attestation_grant_evidence (archived_at);

ALTER TABLE private.product_description_attestation_grant_evidence OWNER TO postgres;

CREATE OR REPLACE FUNCTION private.cleanup_product_description_attestation_grants(
  p_limit integer DEFAULT 1000
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deleted integer;
BEGIN
  WITH doomed AS MATERIALIZED (
    SELECT
      id,
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
      created_at,
      expires_at,
      consumed_at
    FROM private.product_description_attestation_grants
    WHERE consumed_at IS NOT NULL
       OR expires_at <= pg_catalog.clock_timestamp()
    ORDER BY expires_at
    LIMIT GREATEST(COALESCE(p_limit, 1000), 1)
    FOR UPDATE SKIP LOCKED
  ), archived AS (
    INSERT INTO private.product_description_attestation_grant_evidence (
      id,
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
      created_at,
      expires_at,
      consumed_at
    )
    SELECT
      id,
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
      created_at,
      expires_at,
      consumed_at
    FROM doomed
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  )
  DELETE FROM private.product_description_attestation_grants AS grants
  USING archived
  WHERE grants.id = archived.id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

ALTER FUNCTION private.cleanup_product_description_attestation_grants(integer)
  OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION private.cleanup_product_description_attestation_grants(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.cleanup_product_description_attestation_grants(integer)
  TO service_role;

COMMENT ON FUNCTION private.cleanup_product_description_attestation_grants(integer) IS
  'C1 retention: archives then removes up to p_limit consumed or expired '
  'attestation grants (FOR UPDATE SKIP LOCKED); immutable evidence remains '
  'in private.product_description_attestation_grant_evidence. Service-role '
  'only, run by the pg_cron schedule below.';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = 'cron'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM cron.job
      WHERE jobname = 'product-description-attestation-grant-cleanup'
    ) THEN
      PERFORM cron.unschedule('product-description-attestation-grant-cleanup');
    END IF;
    PERFORM cron.schedule(
      'product-description-attestation-grant-cleanup',
      '23 * * * *',
      $cron$SELECT private.cleanup_product_description_attestation_grants(1000)$cron$
    );
  END IF;
END $$;
