-- Evaluate the immutable JWT user id once per statement instead of once per
-- candidate row. The customer, merchant, role, and operation scopes are
-- otherwise identical to the existing policies.

SET LOCAL lock_timeout = '5s';

ALTER POLICY customer_reads_own_currency_wallet
  ON public.customer_wallet_accounts
  USING (
    EXISTS (
      SELECT 1
      FROM public.customers AS c
      WHERE c.id = customer_wallet_accounts.customer_id
        AND c.merchant_id = customer_wallet_accounts.merchant_id
        AND c.user_id = (SELECT auth.uid())
    )
  );

ALTER POLICY customer_reads_own_currency_wallet_transactions
  ON public.customer_wallet_account_transactions
  USING (
    EXISTS (
      SELECT 1
      FROM public.customers AS c
      WHERE c.id = customer_wallet_account_transactions.customer_id
        AND c.merchant_id = customer_wallet_account_transactions.merchant_id
        AND c.user_id = (SELECT auth.uid())
    )
  );

ALTER POLICY customer_reads_own_petrock_orders
  ON public.petrock_orders
  USING (
    EXISTS (
      SELECT 1
      FROM public.customers AS c
      WHERE c.id = petrock_orders.customer_id
        AND c.merchant_id = petrock_orders.merchant_id
        AND c.user_id = (SELECT auth.uid())
    )
  );
