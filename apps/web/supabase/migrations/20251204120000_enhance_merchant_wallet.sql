-- Enhance Merchant Wallet System
-- Adds support for tracking payments from multiple sources with settlement times

-- Add new columns to merchant_wallets for tracking upcoming settlements
ALTER TABLE merchant_wallets
ADD COLUMN IF NOT EXISTS upcoming_balance DECIMAL(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS upcoming_count INTEGER DEFAULT 0;

-- Add index for settlement queries
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_settlement ON wallet_transactions(status, created_at)
WHERE status = 'pending';

-- Create table for tracking upcoming settlements (product sales, not just VTU)
CREATE TABLE IF NOT EXISTS merchant_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  wallet_id UUID REFERENCES merchant_wallets(id) ON DELETE SET NULL,

  -- Source details
  source_type TEXT NOT NULL CHECK (source_type IN ('order', 'vtu_commission', 'refund', 'adjustment')),
  source_id UUID, -- order_id, vtu_transaction_id, etc.

  -- Payment gateway info
  gateway TEXT NOT NULL CHECK (gateway IN ('paystack', 'korapay', 'credit_direct', 'kuda', 'manual')),
  gateway_reference TEXT,

  -- Amount details (in Naira)
  gross_amount DECIMAL(12,2) NOT NULL, -- Total payment amount
  gateway_fee DECIMAL(10,2) DEFAULT 0.00, -- Payment gateway fee
  platform_fee DECIMAL(10,2) DEFAULT 0.00, -- Baci platform fee
  net_amount DECIMAL(12,2) NOT NULL, -- Amount merchant will receive

  -- Settlement timing
  payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- When payment was received
  expected_settlement_date DATE NOT NULL, -- When funds should be available
  actual_settlement_date DATE, -- When funds actually became available

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'settled', 'failed', 'cancelled')),

  -- Notification tracking
  settlement_notified BOOLEAN DEFAULT FALSE,
  notification_sent_at TIMESTAMPTZ,

  -- Metadata
  description TEXT,
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_merchant_settlements_merchant ON merchant_settlements(merchant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_settlements_status ON merchant_settlements(status);
CREATE INDEX IF NOT EXISTS idx_merchant_settlements_expected_date ON merchant_settlements(expected_settlement_date);
CREATE INDEX IF NOT EXISTS idx_merchant_settlements_gateway ON merchant_settlements(gateway);
CREATE INDEX IF NOT EXISTS idx_merchant_settlements_source ON merchant_settlements(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_merchant_settlements_pending ON merchant_settlements(merchant_id, status)
WHERE status IN ('pending', 'processing');

-- Enable RLS
ALTER TABLE merchant_settlements ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Merchants can view their own settlements"
  ON merchant_settlements FOR SELECT
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    )
  );

-- Function to calculate expected settlement date based on gateway
CREATE OR REPLACE FUNCTION calculate_settlement_date(
  p_gateway TEXT,
  p_payment_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS DATE AS $$
BEGIN
  CASE p_gateway
    -- Korapay: Instant settlement
    WHEN 'korapay' THEN
      RETURN p_payment_date::DATE;
    -- Paystack: T+1 settlement (next business day)
    WHEN 'paystack' THEN
      -- Simple T+1: just add 1 day (could be enhanced for weekends)
      RETURN (p_payment_date + INTERVAL '1 day')::DATE;
    -- Credit Direct: Varies based on BNPL terms
    WHEN 'credit_direct' THEN
      -- Typically 1-2 business days
      RETURN (p_payment_date + INTERVAL '2 days')::DATE;
    -- Kuda (VTU): Weekly payout
    WHEN 'kuda' THEN
      -- VTU commissions are paid weekly, calculate next payout day
      RETURN (p_payment_date + INTERVAL '7 days')::DATE;
    -- Manual/other: Same day
    ELSE
      RETURN p_payment_date::DATE;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to record a new settlement (called after successful payment)
CREATE OR REPLACE FUNCTION record_merchant_settlement(
  p_merchant_id UUID,
  p_source_type TEXT,
  p_source_id UUID,
  p_gateway TEXT,
  p_gateway_reference TEXT,
  p_gross_amount DECIMAL(12,2),
  p_gateway_fee DECIMAL(10,2) DEFAULT 0,
  p_platform_fee DECIMAL(10,2) DEFAULT 0,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
  v_net_amount DECIMAL(12,2);
  v_expected_date DATE;
  v_settlement_id UUID;
BEGIN
  -- Get or create wallet
  v_wallet_id := get_or_create_merchant_wallet(p_merchant_id);

  -- Calculate net amount
  v_net_amount := p_gross_amount - p_gateway_fee - p_platform_fee;

  -- Calculate expected settlement date
  v_expected_date := calculate_settlement_date(p_gateway);

  -- Create settlement record
  INSERT INTO merchant_settlements (
    merchant_id,
    wallet_id,
    source_type,
    source_id,
    gateway,
    gateway_reference,
    gross_amount,
    gateway_fee,
    platform_fee,
    net_amount,
    payment_date,
    expected_settlement_date,
    description,
    status
  )
  VALUES (
    p_merchant_id,
    v_wallet_id,
    p_source_type,
    p_source_id,
    p_gateway,
    p_gateway_reference,
    p_gross_amount,
    p_gateway_fee,
    p_platform_fee,
    v_net_amount,
    NOW(),
    v_expected_date,
    COALESCE(p_description, 'Payment received'),
    CASE
      -- Korapay settles instantly
      WHEN p_gateway = 'korapay' THEN 'settled'
      ELSE 'pending'
    END
  )
  RETURNING id INTO v_settlement_id;

  -- Update wallet upcoming balance (for non-instant settlements)
  IF p_gateway != 'korapay' THEN
    UPDATE merchant_wallets
    SET
      upcoming_balance = upcoming_balance + v_net_amount,
      upcoming_count = upcoming_count + 1,
      updated_at = NOW()
    WHERE id = v_wallet_id;
  ELSE
    -- For instant settlements (Korapay), credit wallet immediately
    UPDATE merchant_wallets
    SET
      available_balance = available_balance + v_net_amount,
      total_earned = total_earned + v_net_amount,
      updated_at = NOW()
    WHERE id = v_wallet_id;

    -- Also create wallet transaction
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
    SELECT
      v_wallet_id,
      p_merchant_id,
      'credit',
      v_net_amount,
      mw.available_balance,
      p_source_type,
      p_source_id,
      COALESCE(p_description, 'Payment settled'),
      'completed'
    FROM merchant_wallets mw WHERE mw.id = v_wallet_id;
  END IF;

  RETURN v_settlement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process settlements that have reached their expected date
-- Called by cron job daily
CREATE OR REPLACE FUNCTION process_due_settlements()
RETURNS TABLE(
  processed_count INTEGER,
  total_amount DECIMAL(12,2),
  details JSONB
) AS $$
DECLARE
  v_processed INTEGER := 0;
  v_total DECIMAL(12,2) := 0;
  v_details JSONB := '[]'::JSONB;
  v_settlement RECORD;
BEGIN
  -- Process all pending settlements that are due
  FOR v_settlement IN
    SELECT *
    FROM merchant_settlements
    WHERE status = 'pending'
    AND expected_settlement_date <= CURRENT_DATE
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Update settlement status
    UPDATE merchant_settlements
    SET
      status = 'settled',
      actual_settlement_date = CURRENT_DATE,
      updated_at = NOW()
    WHERE id = v_settlement.id;

    -- Move from upcoming to available balance
    UPDATE merchant_wallets
    SET
      upcoming_balance = upcoming_balance - v_settlement.net_amount,
      upcoming_count = GREATEST(0, upcoming_count - 1),
      available_balance = available_balance + v_settlement.net_amount,
      total_earned = total_earned + v_settlement.net_amount,
      updated_at = NOW()
    WHERE id = v_settlement.wallet_id;

    -- Create wallet transaction
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
    SELECT
      v_settlement.wallet_id,
      v_settlement.merchant_id,
      'credit',
      v_settlement.net_amount,
      mw.available_balance,
      v_settlement.source_type,
      v_settlement.source_id,
      COALESCE(v_settlement.description, 'Settlement received') || ' via ' || v_settlement.gateway,
      'completed'
    FROM merchant_wallets mw WHERE mw.id = v_settlement.wallet_id;

    v_processed := v_processed + 1;
    v_total := v_total + v_settlement.net_amount;
    v_details := v_details || jsonb_build_object(
      'settlement_id', v_settlement.id,
      'merchant_id', v_settlement.merchant_id,
      'amount', v_settlement.net_amount,
      'gateway', v_settlement.gateway
    );
  END LOOP;

  RETURN QUERY SELECT v_processed, v_total, v_details;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get wallet summary with all balance types
CREATE OR REPLACE FUNCTION get_wallet_summary(p_merchant_id UUID)
RETURNS TABLE(
  wallet_id UUID,
  available_balance DECIMAL(12,2),
  pending_balance DECIMAL(12,2),
  upcoming_balance DECIMAL(12,2),
  upcoming_count INTEGER,
  total_earned DECIMAL(12,2),
  total_withdrawn DECIMAL(12,2),
  can_withdraw BOOLEAN,
  next_settlement_date DATE,
  next_settlement_amount DECIMAL(12,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mw.id,
    mw.available_balance,
    mw.pending_balance,
    mw.upcoming_balance,
    mw.upcoming_count,
    mw.total_earned,
    mw.total_withdrawn,
    mw.available_balance >= 1000.00 AS can_withdraw,
    (
      SELECT MIN(ms.expected_settlement_date)
      FROM merchant_settlements ms
      WHERE ms.merchant_id = p_merchant_id AND ms.status = 'pending'
    ) AS next_settlement_date,
    (
      SELECT COALESCE(SUM(ms.net_amount), 0)
      FROM merchant_settlements ms
      WHERE ms.merchant_id = p_merchant_id
      AND ms.status = 'pending'
      AND ms.expected_settlement_date = (
        SELECT MIN(ms2.expected_settlement_date)
        FROM merchant_settlements ms2
        WHERE ms2.merchant_id = p_merchant_id AND ms2.status = 'pending'
      )
    ) AS next_settlement_amount
  FROM merchant_wallets mw
  WHERE mw.merchant_id = p_merchant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update merchant_settlements.updated_at
CREATE OR REPLACE FUNCTION update_settlement_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_merchant_settlements_updated_at ON merchant_settlements;
CREATE TRIGGER update_merchant_settlements_updated_at
  BEFORE UPDATE ON merchant_settlements
  FOR EACH ROW
  EXECUTE FUNCTION update_settlement_updated_at();

-- Add comments
COMMENT ON TABLE merchant_settlements IS 'Tracks incoming payments and their settlement status for merchants';
COMMENT ON COLUMN merchant_wallets.upcoming_balance IS 'Sum of pending settlements not yet available for withdrawal';
COMMENT ON COLUMN merchant_wallets.upcoming_count IS 'Count of pending settlements';
COMMENT ON FUNCTION record_merchant_settlement IS 'Records a new payment with calculated settlement date';
COMMENT ON FUNCTION process_due_settlements IS 'Processes settlements that have reached their expected date';
COMMENT ON FUNCTION get_wallet_summary IS 'Gets comprehensive wallet summary including upcoming settlements';
