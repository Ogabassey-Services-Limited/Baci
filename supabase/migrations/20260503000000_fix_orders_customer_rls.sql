-- Fix orders and order_items RLS so authenticated storefront customers
-- can read their own orders.
--
-- Root cause: the old policy checked `customer_id = auth.uid()`, but
-- orders.customer_id is the customers table primary key (a generated UUID),
-- not the auth user UUID. The correct check is a subquery through the
-- customers table using customers.user_id = auth.uid().

DROP POLICY IF EXISTS "orders_select_policy" ON "public"."orders";
CREATE POLICY "orders_select_policy" ON "public"."orders"
  FOR SELECT USING (
    "public"."has_merchant_access"("merchant_id")
    OR "customer_id" IN (
      SELECT "id" FROM "public"."customers"
      WHERE "user_id" = ( SELECT "auth"."uid"())
    )
  );

DROP POLICY IF EXISTS "order_items_select_policy" ON "public"."order_items";
CREATE POLICY "order_items_select_policy" ON "public"."order_items"
  FOR SELECT USING (
    "order_id" IN (
      SELECT "id" FROM "public"."orders"
      WHERE
        "public"."has_merchant_access"("merchant_id")
        OR "customer_id" IN (
          SELECT "id" FROM "public"."customers"
          WHERE "user_id" = ( SELECT "auth"."uid"())
        )
    )
  );
