-- PR-A (V6): make record_cac_verification conflict-safe / idempotent.
--
-- Previously the merchants UPDATE overwrote legal_entity_name / cac_rc_number UNCONDITIONALLY, so a
-- re-verification with a different (or misread) certificate silently clobbered an established legal identity.
-- New rule: only set each field when it is currently NULL/empty OR already equal; on a conflicting non-null
-- mismatch, RAISE 'cac_identity_conflict' so the misread surfaces instead of overwriting.
--
-- Append-only redefinition -- do NOT edit the baseline migration.

CREATE OR REPLACE FUNCTION "public"."record_cac_verification"("p_merchant_id" "uuid", "p_cac_certificate_path" "text", "p_cac_approved_name" "text", "p_rc_number" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $func$
DECLARE
  v_caller_uid    UUID;
  v_existing_rc      TEXT;
  v_existing_name    TEXT;
  v_existing_rc_key   TEXT;
  v_existing_name_key TEXT;
  v_incoming_rc_key   TEXT;
  v_incoming_name_key TEXT;
  v_has_prior_cac     BOOLEAN;
BEGIN
  v_caller_uid := auth.uid();

  -- Atomically authorize and lock the merchant row before comparing identity.
  SELECT m.cac_rc_number,
         m.legal_entity_name,
         EXISTS (
           SELECT 1
             FROM merchant_verifications mv
            WHERE mv.merchant_id = m.id
              AND mv.cac_verified IS TRUE
         )
    INTO v_existing_rc, v_existing_name, v_has_prior_cac
    FROM merchants m
   WHERE m.id = p_merchant_id
     AND m.user_id = v_caller_uid
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  v_existing_rc_key := NULLIF(regexp_replace(UPPER(BTRIM(v_existing_rc)), '[[:space:]-]+', '', 'g'), '');
  v_existing_name_key := NULLIF(UPPER(BTRIM(v_existing_name)), '');
  v_incoming_rc_key := NULLIF(regexp_replace(UPPER(BTRIM(p_rc_number)), '[[:space:]-]+', '', 'g'), '');
  v_incoming_name_key := NULLIF(UPPER(BTRIM(p_cac_approved_name)), '');

  -- Conflict only after a prior successful CAC verification. A manually-entered legal name
  -- from tax/settings is not an established CAC identity and must not block the first
  -- official CAC verification from replacing it.
  -- Compare canonical values so harmless casing/spacing/hyphen differences remain idempotent.
  IF v_has_prior_cac
     AND ((v_existing_rc_key IS NOT NULL AND v_existing_rc_key IS DISTINCT FROM v_incoming_rc_key)
       OR (v_existing_name_key IS NOT NULL AND v_existing_name_key IS DISTINCT FROM v_incoming_name_key)) THEN
    RAISE EXCEPTION 'cac_identity_conflict'
      USING ERRCODE = 'PT409',
            DETAIL = 'CAC verification would overwrite an existing, different legal identity for this merchant.',
            HINT = 'Confirm the CAC RC number and approved name match the merchant legal identity before retrying.';
  END IF;

  INSERT INTO merchant_verifications
    (merchant_id, cac_verified, cac_verified_at, cac_certificate_path, cac_approved_name)
  VALUES (p_merchant_id, TRUE, NOW(), p_cac_certificate_path, p_cac_approved_name)
  ON CONFLICT (merchant_id) DO UPDATE SET
    cac_verified = TRUE, cac_verified_at = NOW(),
    cac_certificate_path = p_cac_certificate_path,
    cac_approved_name = p_cac_approved_name, updated_at = NOW();

  -- Safe now: either the identity fields were null/empty, or they already equal the incoming values.
  -- Preserve the established display values on canonical matches so harmless retry casing/spacing
  -- cannot drift invoices or legal identity displays.
  UPDATE merchants
  SET legal_entity_name = CASE
        WHEN v_has_prior_cac THEN COALESCE(NULLIF(BTRIM(legal_entity_name), ''), p_cac_approved_name)
        ELSE p_cac_approved_name
      END,
      cac_rc_number = CASE
        WHEN v_has_prior_cac THEN COALESCE(NULLIF(BTRIM(cac_rc_number), ''), p_rc_number)
        ELSE p_rc_number
      END,
      kyc_status = CASE
        WHEN kyc_status = 'verified' THEN 'verified'
        ELSE 'pending'
      END
  WHERE id = p_merchant_id
    AND user_id = v_caller_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
END; $func$;

ALTER FUNCTION "public"."record_cac_verification"("p_merchant_id" "uuid", "p_cac_certificate_path" "text", "p_cac_approved_name" "text", "p_rc_number" "text") OWNER TO "postgres";
