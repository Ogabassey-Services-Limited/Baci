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
BEGIN
  v_caller_uid := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM merchants WHERE id = p_merchant_id AND user_id = v_caller_uid) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Lock the row and read the current legal identity.
  SELECT cac_rc_number, legal_entity_name
    INTO v_existing_rc, v_existing_name
    FROM merchants
   WHERE id = p_merchant_id
   FOR UPDATE;

  v_existing_rc_key := NULLIF(UPPER(BTRIM(v_existing_rc)), '');
  v_existing_name_key := NULLIF(UPPER(BTRIM(v_existing_name)), '');
  v_incoming_rc_key := NULLIF(UPPER(BTRIM(p_rc_number)), '');
  v_incoming_name_key := NULLIF(UPPER(BTRIM(p_cac_approved_name)), '');

  -- Conflict: an established (non-null / non-empty) identity differs from what we are about to write.
  -- Compare canonical values so harmless casing/spacing differences remain idempotent.
  IF (v_existing_rc_key IS NOT NULL AND v_existing_rc_key IS DISTINCT FROM v_incoming_rc_key)
     OR (v_existing_name_key IS NOT NULL AND v_existing_name_key IS DISTINCT FROM v_incoming_name_key) THEN
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
  UPDATE merchants
  SET legal_entity_name = p_cac_approved_name,
      cac_rc_number = p_rc_number,
      kyc_status = CASE
        WHEN kyc_status = 'verified' THEN 'verified'
        ELSE 'pending'
      END
  WHERE id = p_merchant_id;
END; $func$;

ALTER FUNCTION "public"."record_cac_verification"("p_merchant_id" "uuid", "p_cac_certificate_path" "text", "p_cac_approved_name" "text", "p_rc_number" "text") OWNER TO "postgres";