-- Add assurance fields to order_items
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS has_assurance BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS assurance_fee NUMERIC(10, 2) DEFAULT 0;

-- Ensure order_insurance_policies table exists
CREATE TABLE IF NOT EXISTS order_insurance_policies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  merchant_id UUID REFERENCES merchants(id),
  mycover_policy_id TEXT,
  mycover_policy_number TEXT,
  mycover_purchase_id TEXT,
  coverage_amount NUMERIC(10, 2),
  premium_amount NUMERIC(10, 2),
  premium_currency TEXT DEFAULT 'NGN',
  policy_start_date TIMESTAMPTZ,
  policy_expiry_date TIMESTAMPTZ,
  status TEXT DEFAULT 'pending', -- pending, active, expired, claimed
  claim_status TEXT, -- pending, approved, rejected
  claim_id TEXT,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  shipping_address JSONB,
  items_insured JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
