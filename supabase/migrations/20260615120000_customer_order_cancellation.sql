-- Customer self-service order cancellation.
--
-- Lets a storefront customer cancel their own order while it is still unpaid
-- and not yet shipped. Adds:
--   1. cancellation metadata columns on orders
--   2. a private restock helper (managed stock only)
--   3. a private eligibility predicate shared by the cancel + can-cancel RPCs
--   4. public.cancel_order_as_customer  (the only customer write path)
--   5. public.customer_order_can_cancel (authoritative CTA gate)
--   6. a BEFORE UPDATE backstop trigger that prevents a cancelled order from
--      being silently reopened by a late/captured payment
--   7. a reconciliation_review issue type for payment-after-cancellation
--
-- Security: the two RPCs are SECURITY DEFINER (customers cannot UPDATE orders or
-- SELECT transactions under RLS) with `search_path = ''` + fully-qualified names,
-- and EXECUTE is revoked from PUBLIC/anon. The restock + predicate helpers live
-- in the non-exposed `private` schema.

-- 1. Cancellation metadata -----------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_by text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'orders_cancelled_by_check'
      AND n.nspname = 'public'
      AND t.relname = 'orders'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_cancelled_by_check
      CHECK (cancelled_by IS NULL OR cancelled_by IN ('merchant', 'customer'));
  END IF;
END
$$;

-- 2. Private helpers -----------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS private;

-- Reverse of the create_storefront_order stock decrement: returns managed-stock
-- quantities for the order. Variant rows restock the variant; non-variant rows
-- restock the product. Only products with manage_stock = true are touched.
CREATE OR REPLACE FUNCTION private.restock_order_items(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.product_variants v
  SET stock_quantity = v.stock_quantity + agg.qty
  FROM (
    SELECT oi.variant_id AS variant_id, SUM(oi.quantity)::int AS qty
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = p_order_id
      AND oi.variant_id IS NOT NULL
      AND COALESCE(p.manage_stock, false) = true
    GROUP BY oi.variant_id
  ) agg
  WHERE v.id = agg.variant_id;

  UPDATE public.products p
  SET stock_quantity = COALESCE(p.stock_quantity, 0) + agg.qty
  FROM (
    SELECT oi.product_id AS product_id, SUM(oi.quantity)::int AS qty
    FROM public.order_items oi
    JOIN public.products pp ON pp.id = oi.product_id
    WHERE oi.order_id = p_order_id
      AND oi.variant_id IS NULL
      AND oi.product_id IS NOT NULL
      AND COALESCE(pp.manage_stock, false) = true
    GROUP BY oi.product_id
  ) agg
  WHERE p.id = agg.product_id;
END;
$$;

REVOKE ALL ON FUNCTION private.restock_order_items(uuid)
  FROM PUBLIC, anon, authenticated;

-- Eligibility predicate (ownership is checked by the callers, not here):
-- unpaid + not yet shipped + no in-flight/captured payment transaction.
CREATE OR REPLACE FUNCTION private.order_customer_cancellable(p_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    o.payment_status = 'unpaid'
    AND o.shipping_status IN ('pending', 'processing')
    AND NOT EXISTS (
      SELECT 1
      FROM public.transactions t
      WHERE t.order_id = p_order_id
        AND t.transaction_type = 'payment'
        AND t.status IN ('pending', 'processing', 'completed')
    )
  FROM public.orders o
  WHERE o.id = p_order_id;
$$;

REVOKE ALL ON FUNCTION private.order_customer_cancellable(uuid)
  FROM PUBLIC, anon, authenticated;

-- 3. Authoritative CTA gate ----------------------------------------------------
-- True only when the caller owns the order (via customers.user_id = auth.uid())
-- AND it is eligible. A live DVA alias / wallet intent is NOT a blocker — those
-- are voided by cancel_order_as_customer.
CREATE OR REPLACE FUNCTION public.customer_order_can_cancel(p_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = p_order_id
        AND o.customer_id IN (
          SELECT c.id FROM public.customers c
          WHERE c.user_id = (SELECT auth.uid())
        )
    )
    AND private.order_customer_cancellable(p_order_id);
$$;

REVOKE ALL ON FUNCTION public.customer_order_can_cancel(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_order_can_cancel(uuid) TO authenticated;

-- 4. The cancel RPC (only customer write path) ---------------------------------
-- Returns true if it performed the cancellation, false if the order was already
-- cancelled (idempotent no-op). Raises:
--   order_not_found      -> caller maps to 404 (not owned / missing)
--   order_not_cancellable-> caller maps to 409 (ineligible)
CREATE OR REPLACE FUNCTION public.cancel_order_as_customer(
  p_order_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
BEGIN
  SELECT o.* INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
    AND o.customer_id IN (
      SELECT c.id FROM public.customers c
      WHERE c.user_id = (SELECT auth.uid())
    )
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Idempotent: already cancelled -> no-op, do not re-restock.
  IF v_order.shipping_status = 'cancelled' THEN
    RETURN false;
  END IF;

  IF NOT private.order_customer_cancellable(p_order_id) THEN
    RAISE EXCEPTION 'order_not_cancellable' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.orders o
  SET shipping_status = 'cancelled',
      cancelled_at = now(),
      cancellation_reason = p_reason,
      cancelled_by = 'customer',
      updated_at = now()
  WHERE o.id = p_order_id;

  -- Void already-issued payment instruments so a later inbound payment cannot be
  -- matched back to this cancelled order (these can exist before any transaction).
  UPDATE public.order_payment_accounts a
  SET expires_at = now()
  WHERE a.order_id = p_order_id
    AND (a.expires_at IS NULL OR a.expires_at > now());

  UPDATE public.order_wallet_funding_intents i
  SET status = 'cancelled', updated_at = now()
  WHERE i.order_id = p_order_id
    AND i.status NOT IN ('completed', 'cancelled', 'expired', 'failed');

  PERFORM private.restock_order_items(p_order_id);

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_order_as_customer(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_order_as_customer(uuid, text) TO authenticated;

-- 5. Reopen backstop trigger ---------------------------------------------------
-- A cancelled order must never be silently reopened by a late/captured payment,
-- regardless of which finalizer (app route or RPC) issues the UPDATE. Clamp the
-- reopen instead of raising, so webhooks don't error-loop and their transaction
-- rows still record (money stays tracked). Only blocks the reopen signals:
-- advancing shipping_status, or moving payment_status into paid/partially_paid.
-- Legitimate post-cancel transitions (e.g. payment_status -> refunded) are
-- preserved, as are non-status edits.
CREATE OR REPLACE FUNCTION public.prevent_cancelled_order_reopen()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.shipping_status = 'cancelled' THEN
    IF NEW.shipping_status IS DISTINCT FROM 'cancelled' THEN
      NEW.shipping_status := 'cancelled';
    END IF;
    IF NEW.payment_status IN ('paid', 'partially_paid')
       AND NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
      NEW.payment_status := OLD.payment_status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_cancelled_order_reopen ON public.orders;
CREATE TRIGGER prevent_cancelled_order_reopen
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_cancelled_order_reopen();

-- 6. Reconciliation issue type -------------------------------------------------
ALTER TABLE public.reconciliation_review
  DROP CONSTRAINT IF EXISTS reconciliation_review_issue_type_check;

ALTER TABLE public.reconciliation_review
  ADD CONSTRAINT reconciliation_review_issue_type_check CHECK (issue_type IN (
    'payment_match_ambiguous',
    'payment_match_zero_candidates',
    'manage_stock_cancellation_held',
    'tax_basis_unclassified',
    'tax_basis_inconsistent_total',
    'wallet_dva_order_alias_conflict',
    'customer_savings_auto_debit_allocation_failed',
    'wallet_order_funding_ambiguous',
    'wallet_order_funding_conflict',
    'wallet_order_funding_finalize_failed',
    'payment_received_after_cancellation'
  ));
