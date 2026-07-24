-- ============================================================================
-- S1 PR 3b: reject delegated-staff writes to merchant credential columns.
-- ============================================================================
-- The `Consolidated update permissions` UPDATE policy on public.merchants lets
-- any `settings.edit` staff member UPDATE the row via raw authenticated
-- PostgREST. The app UI only exposes non-secret settings to non-owner staff,
-- but that owner-only gating is client-side honesty; a crafted PostgREST PATCH
-- from a settings.edit staff token could rewrite payout, identity, billing, or
-- ad-platform credential columns. This BEFORE UPDATE trigger fails such writes
-- closed at the database boundary while leaving every trusted path working.
--
-- Trusted paths that bypass the guard (design choices):
--   * auth.role() IS NULL       -> migrations, psql, and superuser maintenance
--                                  have no request JWT; backfills must keep
--                                  working.
--   * auth.role() = 'service_role' -> the admin/service-role client (server-
--                                  only edges) is already fully trusted.
--   * auth.uid() = OLD.user_id  -> the merchant OWNER editing their own row.
--
-- Everyone else (delegated staff acting through the authenticated role under
-- the Consolidated update policy) may still update non-credential columns, but
-- any attempt to CHANGE an owner-only credential column raises 42501. The two
-- payment-INTEGRATION columns (paystack_subaccount_code,
-- virtual_terminal_code) are instead gated on integrations.manage via
-- check_staff_permission, because the sanctioned subaccount/virtual-terminal
-- staff flows legitimately write them under exactly that permission.
--
-- `IS DISTINCT FROM` per column (NULL-safe) means a no-op write -- e.g. a staff
-- member saving settings that re-send the same credential values, or that touch
-- none of them -- passes untouched; only an actual change is rejected.
--
-- SECURITY INVOKER: auth.uid()/auth.role() read the PostgREST request GUCs and
-- are unaffected by the function's security context, so no DEFINER escalation
-- is needed. A function returning `trigger` is not callable via PostgREST/RPC
-- and fires regardless of the caller's EXECUTE privilege, so REVOKE ALL is a
-- tidy defensive default, not a functional requirement.
--
-- Column set verified EXHAUSTIVELY against the 20260418000000 baseline
-- merchants schema (every credential/payout/KYC/e-invoice column is covered):
--   * Owner-only: nin, bvn, stripe_customer_id, stripe_subscription_id,
--     cac_number, cac_rc_number, the ad-platform secrets (facebook_capi_token
--     AND its legacy sibling facebook_capi_access_token, ga4_api_secret,
--     tiktok_access_token, snapchat_capi_token), and the full FIRS e-invoice
--     set (firs_public_key, firs_certificate, firs_email,
--     firs_password_encrypted, firs_business_id, firs_service_id).
--   * integrations.manage: the bank/payout family written together by the
--     sanctioned /api/paystack/subaccount + virtual-terminal flows
--     (paystack_subaccount_code, virtual_terminal_code, bank_account_number,
--     bank_account_name, bank_code, bank_name).
-- `stripe_account_id` is intentionally omitted: it does not exist on merchants.
-- INTENTIONALLY NOT guarded (public marketing/config, legitimately editable by
-- settings.edit staff): the pixel/analytics IDs (facebook_pixel_id,
-- google_analytics_id, tiktok_pixel_id, snapchat_pixel_id, twitter_pixel_id --
-- embedded client-side in the storefront) and the FIRS transport-config IDs
-- (endpoint_id, endpoint_scheme_id, template_id -- routing config, not secrets).
-- The trigger additionally rejects staff changes to user_id so a staff member
-- cannot claim ownership and escalate past the owner bypass on a later write.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reject_staff_merchant_credential_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_role text := (SELECT auth.role());
  v_uid uuid := (SELECT auth.uid());
BEGIN
  -- Migration / service-role / owner writes are trusted and pass unchanged.
  IF v_role IS NULL
    OR v_role = 'service_role'
    OR v_uid = OLD.user_id THEN
    RETURN NEW;
  END IF;

  -- Ownership-claim escalation guard: without this, a settings.edit staff
  -- member could PATCH user_id to their own UUID (the trigger's owner bypass
  -- reads OLD.user_id, so THIS statement is evaluated as staff), then on the
  -- NEXT request be treated as the owner and rewrite every guarded credential.
  -- Non-owner/non-service callers may never change ownership.
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION
      'Staff are not permitted to change merchant ownership'
      USING ERRCODE = '42501';
  END IF;

  -- Delegated staff: reject any actual change to an owner-only credential
  -- column. NULL-safe IS DISTINCT FROM lets no-op updates through so
  -- legitimate settings edits that do not touch these columns continue to
  -- succeed.
  IF NEW.nin IS DISTINCT FROM OLD.nin
    OR NEW.bvn IS DISTINCT FROM OLD.bvn
    OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
    OR NEW.facebook_capi_token IS DISTINCT FROM OLD.facebook_capi_token
    OR NEW.facebook_capi_access_token
      IS DISTINCT FROM OLD.facebook_capi_access_token
    OR NEW.ga4_api_secret IS DISTINCT FROM OLD.ga4_api_secret
    OR NEW.tiktok_access_token IS DISTINCT FROM OLD.tiktok_access_token
    OR NEW.snapchat_capi_token IS DISTINCT FROM OLD.snapchat_capi_token
    OR NEW.firs_public_key IS DISTINCT FROM OLD.firs_public_key
    OR NEW.firs_certificate IS DISTINCT FROM OLD.firs_certificate
    OR NEW.firs_email IS DISTINCT FROM OLD.firs_email
    OR NEW.firs_password_encrypted
      IS DISTINCT FROM OLD.firs_password_encrypted
    OR NEW.firs_business_id IS DISTINCT FROM OLD.firs_business_id
    OR NEW.firs_service_id IS DISTINCT FROM OLD.firs_service_id
    OR NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id
    OR NEW.cac_number IS DISTINCT FROM OLD.cac_number
    OR NEW.cac_rc_number IS DISTINCT FROM OLD.cac_rc_number THEN
    RAISE EXCEPTION
      'Staff are not permitted to modify merchant credential columns'
      USING ERRCODE = '42501';
  END IF;

  -- The payment-INTEGRATION columns are staff-writable under the
  -- integrations.manage permission the sanctioned flows already enforce:
  --   * paystack_subaccount_code AND the three bank fields
  --     (bank_account_number, bank_account_name, bank_code) are written
  --     TOGETHER by /api/paystack/subaccount (manual + verified paths) — the
  --     route saves the bank details alongside the subaccount code, so the bank
  --     columns must share this gate or every staff subaccount setup 42501s
  --     after the external Paystack subaccount is already created (orphan risk).
  --   * virtual_terminal_code is mirrored by the virtual-terminal route/RPCs
  --     (set/clear_merchant_virtual_terminal_code*, integrations.manage-gated
  --     since #3173).
  -- Owner bypasses this whole trigger; settings.edit-only staff (no
  -- integrations.manage) remain blocked from bank/subaccount/terminal edits.
  -- check_staff_permission is wildcard-aware and, after 20260724000001, reads
  -- deep-merged effective permissions.
  IF (NEW.paystack_subaccount_code
        IS DISTINCT FROM OLD.paystack_subaccount_code
      OR NEW.virtual_terminal_code IS DISTINCT FROM OLD.virtual_terminal_code
      OR NEW.bank_account_number IS DISTINCT FROM OLD.bank_account_number
      OR NEW.bank_account_name IS DISTINCT FROM OLD.bank_account_name
      OR NEW.bank_code IS DISTINCT FROM OLD.bank_code
      OR NEW.bank_name IS DISTINCT FROM OLD.bank_name)
    AND NOT public.check_staff_permission(
      v_uid, OLD.id, 'integrations', 'manage'
    ) THEN
    RAISE EXCEPTION
      'Staff without integrations.manage may not modify payment integration or bank columns'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.reject_staff_merchant_credential_writes() IS
  'BEFORE UPDATE guard on merchants: blocks delegated-staff changes to payout, identity, billing, and ad-platform credential columns; allows owner, service-role, and migration writes.';

REVOKE ALL ON FUNCTION public.reject_staff_merchant_credential_writes()
  FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS merchants_reject_staff_credential_writes
  ON public.merchants;

CREATE TRIGGER merchants_reject_staff_credential_writes
  BEFORE UPDATE ON public.merchants
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_staff_merchant_credential_writes();
