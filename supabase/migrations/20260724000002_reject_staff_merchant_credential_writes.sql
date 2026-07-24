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
-- any attempt to CHANGE a credential column raises 42501.
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
-- Column set verified against the 20260418000000 baseline merchants schema.
-- `stripe_account_id` from the PR brief is intentionally omitted: it does not
-- exist on merchants (only stripe_customer_id / stripe_subscription_id do).
-- Both Facebook CAPI token columns are guarded -- facebook_capi_token AND its
-- legacy sibling facebook_capi_access_token -- so the pair cannot be split.
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

  -- Delegated staff: reject any actual change to a credential column. NULL-safe
  -- IS DISTINCT FROM lets no-op updates through so legitimate settings edits
  -- that do not touch these columns continue to succeed.
  IF NEW.nin IS DISTINCT FROM OLD.nin
    OR NEW.bvn IS DISTINCT FROM OLD.bvn
    OR NEW.bank_account_number IS DISTINCT FROM OLD.bank_account_number
    OR NEW.bank_account_name IS DISTINCT FROM OLD.bank_account_name
    OR NEW.bank_code IS DISTINCT FROM OLD.bank_code
    OR NEW.paystack_subaccount_code IS DISTINCT FROM OLD.paystack_subaccount_code
    OR NEW.virtual_terminal_code IS DISTINCT FROM OLD.virtual_terminal_code
    OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
    OR NEW.facebook_capi_token IS DISTINCT FROM OLD.facebook_capi_token
    OR NEW.facebook_capi_access_token
      IS DISTINCT FROM OLD.facebook_capi_access_token
    OR NEW.ga4_api_secret IS DISTINCT FROM OLD.ga4_api_secret
    OR NEW.tiktok_access_token IS DISTINCT FROM OLD.tiktok_access_token
    OR NEW.snapchat_capi_token IS DISTINCT FROM OLD.snapchat_capi_token THEN
    RAISE EXCEPTION
      'Staff are not permitted to modify merchant credential columns'
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
