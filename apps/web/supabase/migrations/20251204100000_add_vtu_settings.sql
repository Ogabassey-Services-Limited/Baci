-- Add VTU (Value Top-Up) settings to merchant_feature_settings
-- This enables merchants to offer airtime/data purchases to their customers

ALTER TABLE merchant_feature_settings
ADD COLUMN IF NOT EXISTS vtu_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS vtu_airtime_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS vtu_data_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS vtu_checkout_addon_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS vtu_checkout_addon_amounts INTEGER[] DEFAULT ARRAY[100, 200, 500, 1000],
ADD COLUMN IF NOT EXISTS vtu_loyalty_reward_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS vtu_merchant_commission_rate DECIMAL(5,2) DEFAULT 50.00;

-- Create VTU transactions table to track all airtime/data purchases
CREATE TABLE IF NOT EXISTS vtu_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,

  -- Transaction details
  type TEXT NOT NULL CHECK (type IN ('airtime', 'data')),
  network_provider TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,

  -- Kuda transaction info
  request_reference TEXT NOT NULL UNIQUE,
  transaction_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'successful', 'failed')),

  -- Source of purchase
  source TEXT NOT NULL DEFAULT 'checkout' CHECK (source IN ('checkout', 'loyalty_reward', 'direct', 'gift')),

  -- Commission tracking
  platform_commission DECIMAL(10,2) DEFAULT 0,
  merchant_commission DECIMAL(10,2) DEFAULT 0,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_vtu_transactions_merchant ON vtu_transactions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_vtu_transactions_customer ON vtu_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_vtu_transactions_order ON vtu_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_vtu_transactions_status ON vtu_transactions(status);
CREATE INDEX IF NOT EXISTS idx_vtu_transactions_reference ON vtu_transactions(request_reference);
CREATE INDEX IF NOT EXISTS idx_vtu_transactions_created ON vtu_transactions(created_at DESC);

-- Enable RLS
ALTER TABLE vtu_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for vtu_transactions
CREATE POLICY "Merchants can view their own VTU transactions"
  ON vtu_transactions FOR SELECT
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Merchants can insert VTU transactions"
  ON vtu_transactions FOR INSERT
  WITH CHECK (
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Merchants can update their own VTU transactions"
  ON vtu_transactions FOR UPDATE
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    )
  );

-- Add loyalty rewards table for airtime rewards
CREATE TABLE IF NOT EXISTS loyalty_airtime_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,

  -- Reward configuration
  name TEXT NOT NULL,
  description TEXT,
  points_required INTEGER NOT NULL,
  airtime_amount DECIMAL(10,2) NOT NULL,
  network_provider TEXT, -- NULL means customer chooses
  is_active BOOLEAN DEFAULT true,

  -- Usage limits
  max_redemptions_per_customer INTEGER,
  total_redemptions INTEGER DEFAULT 0,
  max_total_redemptions INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_loyalty_airtime_rewards_merchant ON loyalty_airtime_rewards(merchant_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_airtime_rewards_active ON loyalty_airtime_rewards(is_active);

-- Enable RLS
ALTER TABLE loyalty_airtime_rewards ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Merchants can manage their airtime rewards"
  ON loyalty_airtime_rewards FOR ALL
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Public can view active airtime rewards"
  ON loyalty_airtime_rewards FOR SELECT
  USING (is_active = true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_vtu_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_vtu_transactions_updated_at ON vtu_transactions;
CREATE TRIGGER update_vtu_transactions_updated_at
  BEFORE UPDATE ON vtu_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_vtu_updated_at();

DROP TRIGGER IF EXISTS update_loyalty_airtime_rewards_updated_at ON loyalty_airtime_rewards;
CREATE TRIGGER update_loyalty_airtime_rewards_updated_at
  BEFORE UPDATE ON loyalty_airtime_rewards
  FOR EACH ROW
  EXECUTE FUNCTION update_vtu_updated_at();

-- Add comment for documentation
COMMENT ON TABLE vtu_transactions IS 'Tracks all VTU (airtime/data) purchases made through the platform';
COMMENT ON TABLE loyalty_airtime_rewards IS 'Configures airtime rewards that customers can redeem with loyalty points';
