CREATE TABLE IF NOT EXISTS public.customer_wallet_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  currency text NOT NULL CHECK (currency IN ('USDT')),
  available_balance numeric(20, 6) NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
  total_credited numeric(20, 6) NOT NULL DEFAULT 0 CHECK (total_credited >= 0),
  total_debited numeric(20, 6) NOT NULL DEFAULT 0 CHECK (total_debited >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_wallet_accounts_owner_currency_key
    UNIQUE (customer_id, merchant_id, currency)
);

CREATE TABLE IF NOT EXISTS public.customer_wallet_account_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.customer_wallet_accounts(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  currency text NOT NULL CHECK (currency IN ('USDT')),
  type text NOT NULL CHECK (type IN ('credit', 'debit', 'refund')),
  amount numeric(20, 6) NOT NULL CHECK (amount > 0),
  balance_after numeric(20, 6) NOT NULL CHECK (balance_after >= 0),
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, source_type, source_id, type)
);

CREATE INDEX IF NOT EXISTS idx_customer_wallet_accounts_owner
  ON public.customer_wallet_accounts (customer_id, merchant_id, currency);
CREATE INDEX IF NOT EXISTS idx_customer_wallet_accounts_merchant
  ON public.customer_wallet_accounts (merchant_id);
CREATE INDEX IF NOT EXISTS idx_customer_wallet_account_transactions_recent
  ON public.customer_wallet_account_transactions (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_wallet_account_transactions_customer
  ON public.customer_wallet_account_transactions (customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_wallet_account_transactions_merchant
  ON public.customer_wallet_account_transactions (merchant_id);

ALTER TABLE public.customer_wallet_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_wallet_account_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_reads_own_currency_wallet
  ON public.customer_wallet_accounts;
CREATE POLICY customer_reads_own_currency_wallet
  ON public.customer_wallet_accounts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = customer_wallet_accounts.customer_id
        AND c.merchant_id = customer_wallet_accounts.merchant_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS customer_reads_own_currency_wallet_transactions
  ON public.customer_wallet_account_transactions;
CREATE POLICY customer_reads_own_currency_wallet_transactions
  ON public.customer_wallet_account_transactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = customer_wallet_account_transactions.customer_id
        AND c.merchant_id = customer_wallet_account_transactions.merchant_id
        AND c.user_id = auth.uid()
    )
  );

REVOKE ALL ON public.customer_wallet_accounts FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON public.customer_wallet_accounts FROM authenticated;
GRANT SELECT (id, customer_id, merchant_id, currency, available_balance,
  total_credited, total_debited, created_at, updated_at)
  ON public.customer_wallet_accounts TO authenticated;
GRANT ALL ON public.customer_wallet_accounts TO service_role;

REVOKE ALL ON public.customer_wallet_account_transactions FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON public.customer_wallet_account_transactions
  FROM authenticated;
GRANT SELECT (id, account_id, customer_id, merchant_id, currency, type, amount,
  balance_after, source_type, source_id, description, created_at)
  ON public.customer_wallet_account_transactions TO authenticated;
GRANT ALL ON public.customer_wallet_account_transactions TO service_role;

CREATE OR REPLACE FUNCTION public.credit_customer_wallet_account(
  p_customer_id uuid,
  p_merchant_id uuid,
  p_currency text,
  p_amount numeric,
  p_source_type text,
  p_source_id uuid,
  p_description text DEFAULT NULL
)
RETURNS TABLE (
  success boolean,
  new_balance numeric,
  transaction_id uuid,
  currency text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_account public.customer_wallet_accounts%ROWTYPE;
  v_existing public.customer_wallet_account_transactions%ROWTYPE;
  v_transaction_id uuid;
BEGIN
  IF p_currency <> 'USDT' THEN
    RAISE EXCEPTION 'unsupported wallet currency' USING ERRCODE = '22023';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'wallet account credit amount must be positive'
      USING ERRCODE = '22023';
  END IF;
  IF NULLIF(p_source_type, '') IS NULL OR p_source_id IS NULL THEN
    RAISE EXCEPTION 'wallet account credit source is required'
      USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.id = p_customer_id AND c.merchant_id = p_merchant_id
  ) THEN
    RAISE EXCEPTION 'Customer does not belong to merchant'
      USING ERRCODE = '42501';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_customer_id::text || ':' || p_merchant_id::text || ':' || p_currency,
      0
    )
  );

  INSERT INTO public.customer_wallet_accounts (
    customer_id,
    merchant_id,
    currency
  )
  VALUES (p_customer_id, p_merchant_id, p_currency)
  ON CONFLICT ON CONSTRAINT customer_wallet_accounts_owner_currency_key
    DO NOTHING;

  SELECT * INTO v_account
  FROM public.customer_wallet_accounts a
  WHERE a.customer_id = p_customer_id
    AND a.merchant_id = p_merchant_id
    AND a.currency = p_currency
  FOR UPDATE;

  SELECT * INTO v_existing
  FROM public.customer_wallet_account_transactions t
  WHERE t.account_id = v_account.id
    AND t.source_type = p_source_type
    AND t.source_id = p_source_id
    AND t.type = 'credit'
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    RETURN QUERY SELECT true, v_existing.balance_after, v_existing.id, p_currency;
    RETURN;
  END IF;

  UPDATE public.customer_wallet_accounts a
  SET available_balance = a.available_balance + p_amount,
      total_credited = a.total_credited + p_amount,
      updated_at = now()
  WHERE a.id = v_account.id
  RETURNING a.available_balance INTO v_account.available_balance;

  INSERT INTO public.customer_wallet_account_transactions (
    account_id,
    customer_id,
    merchant_id,
    currency,
    type,
    amount,
    balance_after,
    source_type,
    source_id,
    description
  )
  VALUES (
    v_account.id,
    p_customer_id,
    p_merchant_id,
    p_currency,
    'credit',
    p_amount,
    v_account.available_balance,
    p_source_type,
    p_source_id,
    p_description
  )
  RETURNING id INTO v_transaction_id;

  RETURN QUERY
    SELECT true, v_account.available_balance, v_transaction_id, p_currency;
END;
$$;

REVOKE ALL ON FUNCTION public.credit_customer_wallet_account(
  uuid, uuid, text, numeric, text, uuid, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_customer_wallet_account(
  uuid, uuid, text, numeric, text, uuid, text
) TO service_role;
