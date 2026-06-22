-- P0 fix: "column reference id is ambiguous" (SQLSTATE 42702) blocking order creation.
--
-- private.create_storefront_order (and its quiz-voucher variant) are declared
-- `RETURNS TABLE (id uuid, ...)`, so the OUT column `id` collides with any
-- UNQUALIFIED `id` referenced in the body (PL/pgSQL variable_conflict = error).
--
-- Companion to 20260618105940, which fixed the customer-record
-- `INSERT ... RETURNING id` (the site that fired for every NEW customer,
-- regardless of stock — the actual ogabassey outage). This migration covers
-- the remaining bare-`id` sites that the prior fix did not:
--   * the serialized-inventory policy SELECTs in create_storefront_order
--     (only reached for managed-stock orders), and
--   * four `WHERE id = ...` clauses in create_storefront_order_with_quiz_voucher.
-- Those bite managed-stock merchants and quiz-voucher checkouts.
--
-- Self-patching against the LIVE definition so the rest of each function body
-- is preserved verbatim; idempotent (replacements are no-ops once qualified)
-- and replay-safe (runs after the create migrations by timestamp; the loop
-- simply skips any function that does not exist).
DO $$
DECLARE
  r record;
  def text;
BEGIN
  FOR r IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private'
      AND p.proname IN ('create_storefront_order', 'create_storefront_order_with_quiz_voucher')
  LOOP
    def := pg_get_functiondef(r.oid);
    def := replace(def, 'WHERE id = stock_rec.product_id', 'WHERE products.id = stock_rec.product_id');
    def := replace(def, 'WHERE id = v_variant_id', 'WHERE product_variants.id = v_variant_id');
    def := replace(def, 'WHERE id = v_reserved_order_id', 'WHERE orders.id = v_reserved_order_id');
    def := replace(def, 'WHERE id = v_award_id', 'WHERE quiz_awards.id = v_award_id');
    def := replace(def, 'WHERE id = (', 'WHERE order_items.id = (');
    EXECUTE def;
  END LOOP;
END $$;
