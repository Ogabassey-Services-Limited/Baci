-- Rewrite order_items_select_policy to use correlated EXISTS instead of
-- triple-nested IN. EXISTS short-circuits on first match so the planner
-- can use index scans rather than materialising the full subquery result.
--
-- Also ensure the indexes that make RLS fast are present.

-- Indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_orders_customer_id
  ON "public"."orders" ("customer_id");

CREATE INDEX IF NOT EXISTS idx_customers_user_id
  ON "public"."customers" ("user_id");

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON "public"."order_items" ("order_id");

-- Rewrite the policy
DROP POLICY IF EXISTS "order_items_select_policy" ON "public"."order_items";
CREATE POLICY "order_items_select_policy" ON "public"."order_items"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "public"."orders" o
      WHERE o.id = "public"."order_items"."order_id"
        AND (
          "public"."has_merchant_access"(o."merchant_id")
          OR EXISTS (
            SELECT 1 FROM "public"."customers" c
            WHERE c.id = o."customer_id"
              AND c."user_id" = ( SELECT "auth"."uid"())
          )
        )
    )
  );
