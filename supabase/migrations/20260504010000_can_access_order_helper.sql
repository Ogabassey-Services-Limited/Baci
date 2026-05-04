-- Introduce a helper function that centralises the "can this session see this
-- order?" logic shared between orders_select_policy and
-- order_items_select_policy.  Updating the access rules in future only
-- requires changing can_access_order.
--
-- Takes the two relevant columns rather than the full row so the call site
-- works in both a plain policy USING clause and an EXISTS subquery.
-- SECURITY DEFINER is required so the customers subquery runs with
-- sufficient privilege regardless of the caller's RLS context.
-- search_path is pinned to prevent search-path injection.

CREATE OR REPLACE FUNCTION public.can_access_order(
  p_merchant_id uuid,
  p_customer_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_merchant_access(p_merchant_id)
    OR p_customer_id IN (
      SELECT id
      FROM public.customers
      WHERE user_id = ( SELECT auth.uid() )
    )
$$;

-- Rewrite orders_select_policy to delegate to the helper
DROP POLICY IF EXISTS "orders_select_policy" ON "public"."orders";
CREATE POLICY "orders_select_policy" ON "public"."orders"
  FOR SELECT USING (
    public.can_access_order(merchant_id, customer_id)
  );

-- Rewrite order_items_select_policy to delegate to the helper via EXISTS
DROP POLICY IF EXISTS "order_items_select_policy" ON "public"."order_items";
CREATE POLICY "order_items_select_policy" ON "public"."order_items"
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = order_items.order_id
        AND public.can_access_order(o.merchant_id, o.customer_id)
    )
  );
