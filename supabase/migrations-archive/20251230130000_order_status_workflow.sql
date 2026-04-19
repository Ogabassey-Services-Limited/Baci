-- Order Status Workflow Enhancement
-- Add support for credit orders, virtual payment accounts, and reminders

-- 1. Add credit order columns to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS is_credit_order BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS credit_notes TEXT;

-- 2. Create order_payment_accounts table for virtual accounts
CREATE TABLE IF NOT EXISTS order_payment_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  account_number TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_name TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'korapay',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_order_account UNIQUE (order_id, provider)
);

-- 3. Create order_reminders table to track sent reminders
CREATE TABLE IF NOT EXISTS order_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp')),
  payment_link TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT fk_order FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_order_payment_accounts_order_id ON order_payment_accounts(order_id);
CREATE INDEX IF NOT EXISTS idx_order_reminders_order_id ON order_reminders(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_is_credit ON orders(is_credit_order) WHERE is_credit_order = TRUE;

-- 5. RLS Policies for order_payment_accounts
ALTER TABLE order_payment_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can view their order payment accounts" ON order_payment_accounts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o 
      JOIN merchants m ON o.merchant_id = m.id 
      WHERE o.id = order_payment_accounts.order_id 
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Merchants can insert order payment accounts" ON order_payment_accounts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o 
      JOIN merchants m ON o.merchant_id = m.id 
      WHERE o.id = order_payment_accounts.order_id 
      AND m.user_id = auth.uid()
    )
  );

-- 6. RLS Policies for order_reminders
ALTER TABLE order_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can view their order reminders" ON order_reminders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o 
      JOIN merchants m ON o.merchant_id = m.id 
      WHERE o.id = order_reminders.order_id 
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Merchants can insert order reminders" ON order_reminders
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o 
      JOIN merchants m ON o.merchant_id = m.id 
      WHERE o.id = order_reminders.order_id 
      AND m.user_id = auth.uid()
    )
  );

-- 7. Grant access to authenticated users
GRANT SELECT, INSERT ON order_payment_accounts TO authenticated;
GRANT SELECT, INSERT ON order_reminders TO authenticated;
