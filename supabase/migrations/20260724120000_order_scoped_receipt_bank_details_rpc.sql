-- ============================================================================
-- S0-B: order-scoped receipt/bank details boundary
-- ============================================================================
-- The existing get_storefront_receipt_merchant_info(p_slug) returns a merchant's
-- bank account for ANY published store by slug -- a merchant-id-wide public bank
-- lookup. The S0 retirement plan (workaround-retirement-plan.md, S0-B) requires
-- the destination to be an *authorization-scoped* boundary that returns bank
-- fields only for a SPECIFIC order, proven by one of:
--   (a) a guest capability -- the unguessable tracking_token bound to the order
--       (same secret-bearer pattern as get_order_tracking),
--   (b) the authenticated customer who owns the order
--       (orders.customer_id -> customers.user_id = auth.uid()), or
--   (c) the order's merchant owner / active staff (public.has_merchant_access).
--
-- The function is SECURITY DEFINER so it can read the curated projection without
-- a table grant, and it validates the CAPABILITY (token) or OWNERSHIP internally
-- rather than trusting the caller's role. anon may EXECUTE (guest checkout is the
-- point), but an anon caller with no valid token and no session gets zero rows.
-- Fail-closed everywhere: an unknown order, a wrong token, or an unauthorized
-- caller all return no rows and never confirm the order's existence.
--
-- This is the boundary the mobile-storefront receipt screen switches to: it
-- already has the order id + tracking_token, so it swaps
-- rpc('get_storefront_receipt_merchant_info', { p_slug })
-- for the order-scoped read below (directly, or via the Route Handler wrapper).
-- Once every supported client is on this path and the min-version gate excludes
-- the pre-#3083 raw-table binaries, the S0-A anon bank/contact column grant can
-- be revoked (see docs/architecture/discovery/S0B-final-revoke-DRAFT.sql).
--
-- Idempotent: CREATE OR REPLACE + REVOKE/GRANT are re-runnable.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_order_receipt_bank_details(
  p_order_id uuid,
  p_tracking_token text DEFAULT NULL
) RETURNS TABLE (
  business_name text,
  logo_url text,
  email text,
  phone text,
  support_email text,
  support_phone text,
  rider_phone_number text,
  business_address text,
  cac_rc_number text,
  tax_identification_number text,
  legal_entity_name text,
  brand_colors jsonb,
  vat_registration_status text,
  vat_rate numeric,
  bank_code text,
  bank_account_number text,
  bank_name text,
  bank_account_name text,
  social_media jsonb,
  pages jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_merchant_id uuid;
  v_token text;
  v_uid uuid := (SELECT auth.uid());
  v_authorized boolean := false;
BEGIN
  IF p_order_id IS NULL THEN
    RETURN;
  END IF;

  -- Resolve the order's merchant by the immutable order id. Never trust a
  -- caller-supplied merchant identifier.
  SELECT o.merchant_id INTO v_merchant_id
  FROM public.orders AS o
  WHERE o.id = p_order_id
  LIMIT 1;

  IF v_merchant_id IS NULL THEN
    RETURN; -- unknown order -> no rows (does not leak existence)
  END IF;

  -- (a) Guest capability: an unguessable tracking token bound to THIS order.
  v_token := pg_catalog.nullif(pg_catalog.btrim(p_tracking_token), '');
  IF v_token IS NOT NULL THEN
    SELECT true INTO v_authorized
    FROM public.orders AS o
    WHERE o.id = p_order_id
      AND o.tracking_token = v_token
    LIMIT 1;
  END IF;

  -- (b) Authenticated customer who owns the order.
  IF NOT v_authorized AND v_uid IS NOT NULL THEN
    SELECT true INTO v_authorized
    FROM public.orders AS o
    JOIN public.customers AS c ON c.id = o.customer_id
    WHERE o.id = p_order_id
      AND c.user_id = v_uid
    LIMIT 1;
  END IF;

  -- (c) Merchant owner or active staff of the order's store.
  IF NOT v_authorized AND v_uid IS NOT NULL THEN
    v_authorized := public.has_merchant_access(v_merchant_id);
  END IF;

  IF NOT v_authorized THEN
    RETURN; -- fail closed: no capability, no ownership -> no rows
  END IF;

  RETURN QUERY
  SELECT
    m.business_name,
    m.logo_url,
    m.email,
    m.phone,
    m.support_email,
    m.support_phone,
    m.rider_phone_number,
    m.business_address,
    m.cac_rc_number,
    m.tax_identification_number,
    m.legal_entity_name,
    m.brand_colors,
    m.vat_registration_status,
    m.vat_rate,
    m.bank_code,
    m.bank_account_number,
    m.bank_name,
    m.bank_account_name,
    m.social_media,
    m.pages
  FROM public.merchants AS m
  WHERE m.id = v_merchant_id
  LIMIT 1;
END;
$$;

-- Public execution revoked as defense in depth; the guest-capability path needs
-- anon EXECUTE (a signed-out shopper paying an invoice by transfer), and the
-- ownership paths need authenticated. The function -- not the role -- authorizes.
REVOKE ALL ON FUNCTION public.get_order_receipt_bank_details(uuid, text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_receipt_bank_details(uuid, text)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.get_order_receipt_bank_details(uuid, text) IS
  'S0-B order-scoped receipt/bank projection. Returns the merchant bank/contact receipt fields for ONE order, authorized by an unguessable tracking_token (guest), the owning customer (auth.uid), or the order''s merchant owner/staff (has_merchant_access). Replaces the merchant-slug-wide get_storefront_receipt_merchant_info bank lookup; lets S0-A revoke the anon merchants bank/contact grant.';
