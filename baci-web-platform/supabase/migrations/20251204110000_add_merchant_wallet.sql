-- Add Merchant Wallet System
-- Tracks VTU commission earnings with weekly auto-payout and manual withdrawal

-- Create merchant_wallets table
CREATE TABLE IF NOT EXISTS merchant_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL UNIQUE REFERENCES merchants(id) ON DELETE CASCADE,

  -- Balance tracking
  available_balance DECIMAL(12,2) DEFAULT 0.00,
  pending_balance DECIMAL(12,2) DEFAULT 0.00, -- For processing payouts
  total_earned DECIMAL(12,2) DEFAULT 0.00,
  total_withdrawn DECIMAL(12,2) DEFAULT 0.00,

  -- Payout settings
  auto_payout_enabled BOOLEAN DEFAULT true,
  auto_payout_day TEXT DEFAULT 'monday' CHECK (auto_payout_day IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
  min_payout_amount DECIMAL(10,2) DEFAULT 1000.00,

  -- Last payout info
  last_payout_at TIMESTAMPTZ,
  last_payout_amount DECIMAL(10,2),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create wallet_transactions table for detailed ledger
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES merchant_wallets(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,

  -- Transaction details
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit', 'withdrawal', 'payout', 'refund', 'adjustment')),
  amount DECIMAL(10,2) NOT NULL,
  balance_after DECIMAL(12,2) NOT NULL,

  -- Reference to source transaction
  source_type TEXT, -- 'vtu_transaction', 'order', 'manual', etc.
  source_id UUID,

  -- Status for withdrawals/payouts
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),

  -- Transfer details (for withdrawals/payouts)
  transfer_reference TEXT,
  transfer_status TEXT,
  transfer_message TEXT,

  -- Metadata
  description TEXT,
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_merchant_wallets_merchant ON merchant_wallets(merchant_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_merchant ON wallet_transactions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON wallet_transactions(type);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_status ON wallet_transactions(status);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created ON wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_source ON wallet_transactions(source_type, source_id);

-- Enable RLS
ALTER TABLE merchant_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for merchant_wallets
CREATE POLICY "Merchants can view their own wallet"
  ON merchant_wallets FOR SELECT
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Merchants can update their wallet settings"
  ON merchant_wallets FOR UPDATE
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    )
  );

-- RLS policies for wallet_transactions
CREATE POLICY "Merchants can view their own transactions"
  ON wallet_transactions FOR SELECT
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    )
  );

-- Function to create wallet for new merchants (or get existing)
CREATE OR REPLACE FUNCTION get_or_create_merchant_wallet(p_merchant_id UUID)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
BEGIN
  -- Try to get existing wallet
  SELECT id INTO v_wallet_id FROM merchant_wallets WHERE merchant_id = p_merchant_id;

  -- Create if not exists
  IF v_wallet_id IS NULL THEN
    INSERT INTO merchant_wallets (merchant_id)
    VALUES (p_merchant_id)
    RETURNING id INTO v_wallet_id;
  END IF;

  RETURN v_wallet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to credit merchant wallet
CREATE OR REPLACE FUNCTION credit_merchant_wallet(
  p_merchant_id UUID,
  p_amount DECIMAL(10,2),
  p_source_type TEXT,
  p_source_id UUID,
  p_description TEXT DEFAULT NULL
)
RETURNS TABLE(wallet_id UUID, new_balance DECIMAL(12,2), transaction_id UUID) AS $$
DECLARE
  v_wallet_id UUID;
  v_new_balance DECIMAL(12,2);
  v_transaction_id UUID;
BEGIN
  -- Get or create wallet
  v_wallet_id := get_or_create_merchant_wallet(p_merchant_id);

  -- Update wallet balance
  UPDATE merchant_wallets
  SET
    available_balance = available_balance + p_amount,
    total_earned = total_earned + p_amount,
    updated_at = NOW()
  WHERE id = v_wallet_id
  RETURNING available_balance INTO v_new_balance;

  -- Create transaction record
  INSERT INTO wallet_transactions (
    wallet_id,
    merchant_id,
    type,
    amount,
    balance_after,
    source_type,
    source_id,
    description,
    status
  )
  VALUES (
    v_wallet_id,
    p_merchant_id,
    'credit',
    p_amount,
    v_new_balance,
    p_source_type,
    p_source_id,
    COALESCE(p_description, 'VTU Commission'),
    'completed'
  )
  RETURNING id INTO v_transaction_id;

  RETURN QUERY SELECT v_wallet_id, v_new_balance, v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to debit wallet for withdrawal/payout
CREATE OR REPLACE FUNCTION debit_merchant_wallet(
  p_merchant_id UUID,
  p_amount DECIMAL(10,2),
  p_type TEXT, -- 'withdrawal' or 'payout'
  p_description TEXT DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, wallet_id UUID, new_balance DECIMAL(12,2), transaction_id UUID, error_message TEXT) AS $$
DECLARE
  v_wallet_id UUID;
  v_current_balance DECIMAL(12,2);
  v_new_balance DECIMAL(12,2);
  v_transaction_id UUID;
BEGIN
  -- Get wallet
  SELECT id, available_balance INTO v_wallet_id, v_current_balance
  FROM merchant_wallets
  WHERE merchant_id = p_merchant_id
  FOR UPDATE; -- Lock row

  IF v_wallet_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, 0::DECIMAL(12,2), NULL::UUID, 'Wallet not found'::TEXT;
    RETURN;
  END IF;

  IF v_current_balance < p_amount THEN
    RETURN QUERY SELECT false, v_wallet_id, v_current_balance, NULL::UUID, 'Insufficient balance'::TEXT;
    RETURN;
  END IF;

  -- Update wallet balance
  UPDATE merchant_wallets
  SET
    available_balance = available_balance - p_amount,
    pending_balance = pending_balance + p_amount,
    updated_at = NOW()
  WHERE id = v_wallet_id
  RETURNING available_balance INTO v_new_balance;

  -- Create transaction record (pending status)
  INSERT INTO wallet_transactions (
    wallet_id,
    merchant_id,
    type,
    amount,
    balance_after,
    description,
    status
  )
  VALUES (
    v_wallet_id,
    p_merchant_id,
    p_type,
    p_amount,
    v_new_balance,
    COALESCE(p_description, 'Withdrawal'),
    'pending'
  )
  RETURNING id INTO v_transaction_id;

  RETURN QUERY SELECT true, v_wallet_id, v_new_balance, v_transaction_id, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to complete or fail a withdrawal
CREATE OR REPLACE FUNCTION complete_wallet_withdrawal(
  p_transaction_id UUID,
  p_success BOOLEAN,
  p_transfer_reference TEXT DEFAULT NULL,
  p_transfer_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_wallet_id UUID;
  v_merchant_id UUID;
  v_amount DECIMAL(10,2);
BEGIN
  -- Get transaction details
  SELECT wallet_id, merchant_id, amount INTO v_wallet_id, v_merchant_id, v_amount
  FROM wallet_transactions
  WHERE id = p_transaction_id AND status = 'pending';

  IF v_wallet_id IS NULL THEN
    RETURN false;
  END IF;

  IF p_success THEN
    -- Complete the withdrawal
    UPDATE wallet_transactions
    SET
      status = 'completed',
      transfer_reference = p_transfer_reference,
      transfer_status = 'successful',
      transfer_message = p_transfer_message
    WHERE id = p_transaction_id;

    -- Update wallet
    UPDATE merchant_wallets
    SET
      pending_balance = pending_balance - v_amount,
      total_withdrawn = total_withdrawn + v_amount,
      last_payout_at = NOW(),
      last_payout_amount = v_amount,
      updated_at = NOW()
    WHERE id = v_wallet_id;
  ELSE
    -- Refund the balance
    UPDATE wallet_transactions
    SET
      status = 'failed',
      transfer_reference = p_transfer_reference,
      transfer_status = 'failed',
      transfer_message = p_transfer_message
    WHERE id = p_transaction_id;

    -- Restore balance
    UPDATE merchant_wallets
    SET
      available_balance = available_balance + v_amount,
      pending_balance = pending_balance - v_amount,
      updated_at = NOW()
    WHERE id = v_wallet_id;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_wallet_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_merchant_wallets_updated_at ON merchant_wallets;
CREATE TRIGGER update_merchant_wallets_updated_at
  BEFORE UPDATE ON merchant_wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_wallet_updated_at();

-- Add comments
COMMENT ON TABLE merchant_wallets IS 'Stores merchant wallet balances for VTU commission earnings';
COMMENT ON TABLE wallet_transactions IS 'Ledger of all wallet credits, debits, and withdrawals';
COMMENT ON FUNCTION credit_merchant_wallet IS 'Credits commission to merchant wallet';
COMMENT ON FUNCTION debit_merchant_wallet IS 'Debits wallet for withdrawal/payout';
