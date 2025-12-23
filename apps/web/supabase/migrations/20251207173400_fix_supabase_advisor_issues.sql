-- Migration: Fix Supabase Advisor Issues (Performance & Security)
-- Date: 2025-12-07
-- Fixes:
--   1. Missing index on merchant_settlements.wallet_id
--   2. Function search_path security issues
--   3. RLS init plan performance (auth.uid() -> (select auth.uid()))

-- =============================================================================
-- PART 1: Add Missing Foreign Key Index
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_merchant_settlements_wallet_id 
ON public.merchant_settlements(wallet_id);

-- =============================================================================
-- PART 2: Fix Function Search Paths (Security)
-- =============================================================================

-- Fix credit_merchant_wallet
CREATE OR REPLACE FUNCTION public.credit_merchant_wallet(
  p_merchant_id UUID,
  p_amount BIGINT,
  p_description TEXT DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_wallet_id UUID;
  v_transaction_id UUID;
BEGIN
  -- Get or create wallet with conflict handling for concurrent inserts
  SELECT id INTO v_wallet_id FROM merchant_wallets WHERE merchant_id = p_merchant_id FOR UPDATE;
  
  IF v_wallet_id IS NULL THEN
    INSERT INTO merchant_wallets (merchant_id, balance, pending_balance, currency)
    VALUES (p_merchant_id, 0, 0, 'NGN')
    ON CONFLICT (merchant_id) DO NOTHING
    RETURNING id INTO v_wallet_id;
    
    -- If insert returned NULL due to conflict, another transaction created the wallet
    IF v_wallet_id IS NULL THEN
      SELECT id INTO v_wallet_id FROM merchant_wallets WHERE merchant_id = p_merchant_id FOR UPDATE;
    END IF;
  END IF;
  
  -- Update balance
  UPDATE merchant_wallets 
  SET balance = balance + p_amount, updated_at = NOW()
  WHERE id = v_wallet_id;
  
  -- Record transaction
  INSERT INTO wallet_transactions (wallet_id, type, amount, description, reference_type, reference_id, status)
  VALUES (v_wallet_id, 'credit', p_amount, p_description, p_reference_type, p_reference_id, 'completed')
  RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$;

-- Fix debit_merchant_wallet
CREATE OR REPLACE FUNCTION public.debit_merchant_wallet(
  p_merchant_id UUID,
  p_amount BIGINT,
  p_description TEXT DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_wallet_id UUID;
  v_current_balance BIGINT;
  v_transaction_id UUID;
BEGIN
  -- Get wallet with row lock to prevent concurrent modifications
  SELECT id, balance INTO v_wallet_id, v_current_balance 
  FROM merchant_wallets WHERE merchant_id = p_merchant_id FOR UPDATE;
  
  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Wallet not found for merchant %', p_merchant_id;
  END IF;
  
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance. Available: %, Required: %', v_current_balance, p_amount;
  END IF;
  
  -- Update balance
  UPDATE merchant_wallets 
  SET balance = balance - p_amount, updated_at = NOW()
  WHERE id = v_wallet_id;
  
  -- Record transaction
  INSERT INTO wallet_transactions (wallet_id, type, amount, description, reference_type, reference_id, status)
  VALUES (v_wallet_id, 'debit', p_amount, p_description, p_reference_type, p_reference_id, 'completed')
  RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$;

-- Fix complete_wallet_withdrawal
CREATE OR REPLACE FUNCTION public.complete_wallet_withdrawal(
  p_withdrawal_id UUID,
  p_status TEXT,
  p_failure_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_wallet_id UUID;
  v_amount BIGINT;
BEGIN
  -- Get withdrawal details
  SELECT wallet_id, amount INTO v_wallet_id, v_amount
  FROM wallet_withdrawals WHERE id = p_withdrawal_id AND status = 'pending';
  
  IF v_wallet_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Update withdrawal status
  UPDATE wallet_withdrawals 
  SET status = p_status, 
      failure_reason = p_failure_reason,
      processed_at = CASE WHEN p_status IN ('completed', 'failed') THEN NOW() ELSE NULL END
  WHERE id = p_withdrawal_id;
  
  -- If failed, restore pending balance to available balance
  IF p_status = 'failed' THEN
    UPDATE merchant_wallets 
    SET pending_balance = pending_balance - v_amount,
        balance = balance + v_amount,
        updated_at = NOW()
    WHERE id = v_wallet_id;
  ELSIF p_status = 'completed' THEN
    -- Just reduce pending balance
    UPDATE merchant_wallets 
    SET pending_balance = pending_balance - v_amount,
        updated_at = NOW()
    WHERE id = v_wallet_id;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Fix get_or_create_merchant_wallet
CREATE OR REPLACE FUNCTION public.get_or_create_merchant_wallet(p_merchant_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_wallet_id UUID;
BEGIN
  -- Try to get existing wallet with lock
  SELECT id INTO v_wallet_id FROM merchant_wallets WHERE merchant_id = p_merchant_id FOR UPDATE;
  
  IF v_wallet_id IS NULL THEN
    -- Attempt insert with conflict handling for concurrent creates
    INSERT INTO merchant_wallets (merchant_id, balance, pending_balance, currency)
    VALUES (p_merchant_id, 0, 0, 'NGN')
    ON CONFLICT (merchant_id) DO NOTHING
    RETURNING id INTO v_wallet_id;
    
    -- If insert returned NULL, another transaction created the wallet
    IF v_wallet_id IS NULL THEN
      SELECT id INTO v_wallet_id FROM merchant_wallets WHERE merchant_id = p_merchant_id;
    END IF;
  END IF;
  
  RETURN v_wallet_id;
END;
$$;

-- Fix record_merchant_settlement
CREATE OR REPLACE FUNCTION public.record_merchant_settlement(
  p_wallet_id UUID,
  p_amount BIGINT,
  p_settlement_reference TEXT,
  p_bank_name TEXT DEFAULT NULL,
  p_account_number TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_settlement_id UUID;
BEGIN
  INSERT INTO merchant_settlements (wallet_id, amount, settlement_reference, bank_name, account_number, status)
  VALUES (p_wallet_id, p_amount, p_settlement_reference, p_bank_name, p_account_number, 'completed')
  RETURNING id INTO v_settlement_id;
  
  RETURN v_settlement_id;
END;
$$;

-- Fix update_vtu_updated_at
CREATE OR REPLACE FUNCTION public.update_vtu_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- =============================================================================
-- PART 3: Fix RLS Init Plan Issues (order_tax_subtotals)
-- =============================================================================

-- Drop and recreate the policy with proper (select auth.uid()) pattern
DROP POLICY IF EXISTS "order_tax_subtotals_merchant_access" ON public.order_tax_subtotals;

CREATE POLICY "order_tax_subtotals_merchant_access" ON public.order_tax_subtotals
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM orders o
    JOIN merchants m ON o.merchant_id = m.id
    WHERE o.id = order_tax_subtotals.order_id
    AND m.user_id = (SELECT auth.uid())
  )
);

-- NOTE: loyalty_airtime_rewards policies not updated because loyalty_programs table
-- doesn't exist yet. When that table is created, add proper consolidated policies.
