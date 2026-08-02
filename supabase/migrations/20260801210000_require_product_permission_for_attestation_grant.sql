-- Boundary C1 privacy follow-up: require product permissions before
-- issuing merchant-scoped operation-key grants.

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
  v_existing private.product_description_attestation_grants%ROWTYPE;
  v_archived private.product_description_attestation_grant_evidence%ROWTYPE;
  v_product_merchant_id uuid;
  v_product_description text;
  v_product_source_type text;
  v_product_sha256 text;
  v_product_exists boolean := false;
  v_new_grant_id uuid;
  v_new_expires_at timestamptz;
  c_grant_lifetime constant interval := interval '15 minutes';
  c_max_attempts constant integer := 3;
  v_attempts integer := 0;
  v_recent_issuances bigint;
  c_max_issuances constant bigint := 1000;
  c_issuance_window constant interval := interval '1 hour';
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'product_description_attestation_unauthenticated';
  END IF;

  IF p_merchant_id IS NULL
    OR p_product_id IS NULL
    OR p_operation_id IS NULL
    OR p_proposed_description_sha256 IS NULL
    OR p_proposed_description_sha256 !~ '^[0-9a-f]{64}$'
    OR (p_expected_old_sha256 IS NOT NULL
      AND p_expected_old_sha256 !~ '^[0-9a-f]{64}$')
    OR (p_expected_old_source_type IS NOT NULL
      AND p_expected_old_source_type NOT IN (
        'unknown',
        'default',
        'trained_algorithmic_media'
      ))
    OR p_full_replacement IS NULL
    OR p_purpose IS NULL
    OR p_purpose !~ '^[a-z][a-z0-9_]{2,63}$' THEN
    RAISE EXCEPTION 'product_description_attestation_invalid_binding';
  END IF;

  SELECT
    product.merchant_id,
    product.description,
    product.description_digital_source_type,
    product.description_provenance_sha256
  INTO
    v_product_merchant_id,
    v_product_description,
    v_product_source_type,
    v_product_sha256
  FROM public.products AS product
  WHERE product.id = p_product_id;

  v_product_exists := FOUND;

  IF NOT public.check_staff_permission(
    v_actor_id,
    p_merchant_id,
    'products',
    CASE
      WHEN v_product_exists
        AND v_product_merchant_id = p_merchant_id
        THEN 'edit'
      ELSE 'create'
    END
  ) THEN
    RAISE EXCEPTION 'product_description_attestation_merchant_authority_required';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_merchant_id::text || ':' || p_operation_id::text,
      0
    )
  );

  LOOP
    v_attempts := v_attempts + 1;
    IF v_attempts > c_max_attempts THEN
      RAISE EXCEPTION 'product_description_attestation_retry_limit_exceeded';
    END IF;

    SELECT attestation.* INTO v_existing
    FROM private.product_description_attestation_grants AS attestation
    WHERE attestation.merchant_id = p_merchant_id
      AND attestation.operation_id = p_operation_id
    FOR UPDATE;

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

    SELECT evidence.* INTO v_archived
    FROM private.product_description_attestation_grant_evidence AS evidence
    WHERE evidence.merchant_id = p_merchant_id
      AND evidence.operation_id = p_operation_id;

    IF FOUND THEN
      IF v_archived.merchant_id IS DISTINCT FROM p_merchant_id
        OR v_archived.product_id IS DISTINCT FROM p_product_id
        OR v_archived.actor_id IS DISTINCT FROM v_actor_id
        OR pg_catalog.convert_to(v_archived.expected_old_description, 'UTF8')
             IS DISTINCT FROM pg_catalog.convert_to(p_expected_old_description, 'UTF8')
        OR pg_catalog.convert_to(v_archived.expected_old_source_type, 'UTF8')
             IS DISTINCT FROM pg_catalog.convert_to(p_expected_old_source_type, 'UTF8')
        OR pg_catalog.convert_to(v_archived.expected_old_sha256, 'UTF8')
             IS DISTINCT FROM pg_catalog.convert_to(p_expected_old_sha256, 'UTF8')
        OR pg_catalog.convert_to(v_archived.proposed_description_sha256, 'UTF8')
             IS DISTINCT FROM pg_catalog.convert_to(p_proposed_description_sha256, 'UTF8')
        OR v_archived.full_replacement IS DISTINCT FROM p_full_replacement
        OR pg_catalog.convert_to(v_archived.purpose, 'UTF8')
             IS DISTINCT FROM pg_catalog.convert_to(p_purpose, 'UTF8') THEN
        RAISE EXCEPTION 'product_description_attestation_operation_binding_mismatch';
      END IF;

      IF v_archived.consumed_at IS NOT NULL THEN
        RAISE EXCEPTION 'product_description_attestation_grant_consumed';
      END IF;

      RAISE EXCEPTION 'product_description_attestation_grant_expired';
    END IF;

    IF v_product_exists THEN
      IF v_product_merchant_id IS DISTINCT FROM p_merchant_id THEN
        IF p_expected_old_description IS NOT NULL
          OR p_expected_old_source_type IS NOT NULL
          OR p_expected_old_sha256 IS NOT NULL THEN
          RAISE EXCEPTION 'product_description_attestation_expected_old_mismatch';
        END IF;
        -- A null expected-old triple is also valid for a caller-generated
        -- product UUID. Do not turn the existing-vs-missing distinction into
        -- a cross-tenant product-existence oracle.
      ELSIF pg_catalog.convert_to(v_product_description, 'UTF8')
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
      RAISE EXCEPTION 'product_description_attestation_expected_old_mismatch';
    END IF;

    -- Serialize new grants per merchant so concurrent unique operation IDs
    -- cannot race the rolling issuance budget. Replays returned above do not
    -- consume budget, while active and archived rows both remain counted.
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'product_description_attestation_issuance:' || p_merchant_id::text,
        0
      )
    );

    SELECT count(*) INTO v_recent_issuances
    FROM (
      SELECT 1
      FROM private.product_description_attestation_grants AS active_grant
      WHERE active_grant.merchant_id = p_merchant_id
        AND active_grant.created_at >=
          pg_catalog.clock_timestamp() - c_issuance_window
      UNION ALL
      SELECT 1
      FROM private.product_description_attestation_grant_evidence AS archived_grant
      WHERE archived_grant.merchant_id = p_merchant_id
        AND archived_grant.created_at >=
          pg_catalog.clock_timestamp() - c_issuance_window
    ) AS recent_issuances;

    IF v_recent_issuances >= c_max_issuances THEN
      RAISE EXCEPTION 'product_description_attestation_issuance_rate_limited';
    END IF;

    INSERT INTO private.product_description_attestation_grants AS inserted_grant (
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
      pg_catalog.clock_timestamp() + c_grant_lifetime
    )
    ON CONFLICT (merchant_id, operation_id) DO NOTHING
    RETURNING inserted_grant.id, inserted_grant.expires_at
    INTO v_new_grant_id, v_new_expires_at;

    IF FOUND THEN
      RETURN QUERY SELECT v_new_grant_id, v_new_expires_at;
      RETURN;
    END IF;
  END LOOP;
END;
$$;

-- Keep the old global keys until this replacement function is installed. The
-- two operations commit together in this migration, so an interrupted apply
-- cannot leave the installed function without its conflict target.
ALTER TABLE private.product_description_attestation_grants
  DROP CONSTRAINT IF EXISTS product_description_attestation_grants_operation_id_key;

ALTER TABLE private.product_description_attestation_grant_evidence
  DROP CONSTRAINT IF EXISTS product_description_attestation_grant_evidence_operation_id_key;

REVOKE ALL ON FUNCTION public.request_product_description_attestation_grant(
  uuid, uuid, uuid, text, text, text, text, boolean, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_product_description_attestation_grant(
  uuid, uuid, uuid, text, text, text, text, boolean, text
) TO authenticated;

COMMENT ON FUNCTION public.request_product_description_attestation_grant(uuid, uuid, uuid, text, text, text, text, boolean, text) IS
  'Authenticated attestation grants require products.edit for existing merchant products or products.create for caller-generated product IDs; grants use merchant-scoped operation keys, are idempotent, and are capped at 1000 new grants per merchant per rolling hour.';
