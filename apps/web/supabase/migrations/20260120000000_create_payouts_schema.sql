-- Create payouts table
CREATE TABLE IF NOT EXISTS payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES merchants(id) NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'NGN',
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  reference TEXT UNIQUE, -- Paystack transfer code
  payout_mode TEXT, -- instant, weekly
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- Add index for payouts
CREATE INDEX IF NOT EXISTS idx_payouts_merchant_id ON payouts(merchant_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);

-- Modify orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS payout_status TEXT DEFAULT 'unpaid', -- unpaid, pending, paid
ADD COLUMN IF NOT EXISTS payout_id UUID REFERENCES payouts(id);

-- Add index for orders payout status
CREATE INDEX IF NOT EXISTS idx_orders_payout_status ON orders(payout_status);
CREATE INDEX IF NOT EXISTS idx_orders_payout_id ON orders(payout_id);

-- Add comment
COMMENT ON COLUMN orders.payout_status IS 'Tracks settlement status: unpaid, pending (in transfer), paid';
