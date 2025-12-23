-- Migration: Add redeem_loyalty_points RPC
-- Required for: Mobile app Wallet & Loyalty redemption feature
-- Called by: ogabassey-mobile/app/wallet/index.tsx

-- Create customer_wallets table if not exists
CREATE TABLE IF NOT EXISTS public.customer_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(customer_id, merchant_id)
);

-- Create wallet_transactions table if not exists
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  amount NUMERIC(12, 2) NOT NULL,
  description TEXT,
  source_type TEXT, -- 'loyalty_redemption', 'order_refund', 'cashback', etc.
  source_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_wallets_customer_id ON public.customer_wallets(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_wallets_merchant_id ON public.customer_wallets(merchant_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_customer_id ON public.wallet_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON public.wallet_transactions(created_at DESC);

-- Enable RLS
ALTER TABLE public.customer_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customer_wallets
DROP POLICY IF EXISTS "Customers can view own wallet" ON public.customer_wallets;
CREATE POLICY "Customers can view own wallet" ON public.customer_wallets
  FOR SELECT USING (auth.uid() IN (
    SELECT c.user_id FROM public.customers c WHERE c.id = customer_id
  ));

-- RLS Policies for wallet_transactions
DROP POLICY IF EXISTS "Customers can view own transactions" ON public.wallet_transactions;
CREATE POLICY "Customers can view own transactions" ON public.wallet_transactions
  FOR SELECT USING (auth.uid() IN (
    SELECT c.user_id FROM public.customers c WHERE c.id = customer_id
  ));

-- Redeem Loyalty Points RPC Function
-- Converts loyalty points to wallet balance (1:1 ratio, 100 points = N100)
CREATE OR REPLACE FUNCTION public.redeem_loyalty_points(
  p_customer_id UUID,
  p_merchant_id UUID,
  p_points INTEGER,
  p_wallet_credit NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_points INTEGER;
  v_new_points INTEGER;
  v_new_balance NUMERIC;
BEGIN
  -- Get current loyalty points
  SELECT loyalty_points INTO v_current_points
  FROM public.customers
  WHERE id = p_customer_id;

  IF v_current_points IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Customer not found');
  END IF;

  IF v_current_points < p_points THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient points');
  END IF;

  -- Deduct loyalty points
  v_new_points := v_current_points - p_points;
  UPDATE public.customers
  SET loyalty_points = v_new_points, updated_at = now()
  WHERE id = p_customer_id;

  -- Credit wallet (upsert)
  INSERT INTO public.customer_wallets (customer_id, merchant_id, balance)
  VALUES (p_customer_id, p_merchant_id, p_wallet_credit)
  ON CONFLICT (customer_id, merchant_id)
  DO UPDATE SET
    balance = customer_wallets.balance + p_wallet_credit,
    updated_at = now()
  RETURNING balance INTO v_new_balance;

  -- Record transaction
  INSERT INTO public.wallet_transactions (
    customer_id,
    merchant_id,
    type,
    amount,
    description,
    source_type
  ) VALUES (
    p_customer_id,
    p_merchant_id,
    'credit',
    p_wallet_credit,
    'Loyalty points redemption (' || p_points || ' points)',
    'loyalty_redemption'
  );

  RETURN jsonb_build_object(
    'success', true,
    'points_deducted', p_points,
    'wallet_credited', p_wallet_credit,
    'new_points_balance', v_new_points,
    'new_wallet_balance', v_new_balance
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.redeem_loyalty_points TO authenticated;

COMMENT ON FUNCTION public.redeem_loyalty_points IS
  'Redeems customer loyalty points for wallet credit. Called by mobile app wallet screen.';
