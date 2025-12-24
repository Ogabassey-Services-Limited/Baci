-- Add Shipping Insurance (MyCover.ai) Support
-- Allows merchants to offer shipping protection for orders

-- Add insurance columns to merchant_feature_settings
ALTER TABLE merchant_feature_settings
ADD COLUMN IF NOT EXISTS shipping_insurance_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS shipping_insurance_min_order_value DECIMAL(12, 2) DEFAULT 5000, -- Minimum order value to offer insurance (e.g., ₦5000)
ADD COLUMN IF NOT EXISTS shipping_insurance_opt_in_default BOOLEAN DEFAULT false; -- If true, insurance is pre-selected at checkout

-- Create table to track insurance policies linked to orders
CREATE TABLE IF NOT EXISTS order_insurance_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,

    -- MyCover.ai policy details
    mycover_policy_id VARCHAR(100) NOT NULL,
    mycover_policy_number VARCHAR(100),
    mycover_purchase_id VARCHAR(100),

    -- Coverage details
    coverage_amount DECIMAL(12, 2) NOT NULL, -- Total value insured
    premium_amount DECIMAL(12, 2) NOT NULL, -- Cost of insurance
    premium_currency VARCHAR(3) DEFAULT 'NGN',

    -- Policy dates
    policy_start_date TIMESTAMPTZ,
    policy_expiry_date TIMESTAMPTZ,

    -- Status tracking
    status VARCHAR(50) DEFAULT 'active', -- active, expired, claimed, cancelled
    claim_status VARCHAR(50), -- null, pending, approved, rejected
    claim_id VARCHAR(100),

    -- Customer info snapshot (for claims)
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    shipping_address JSONB,

    -- Item details snapshot
    items_insured JSONB NOT NULL, -- Array of items covered

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(order_id), -- One policy per order
    UNIQUE(mycover_policy_id) -- Unique policy ID from MyCover
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_order_insurance_policies_order_id
ON order_insurance_policies(order_id);

CREATE INDEX IF NOT EXISTS idx_order_insurance_policies_merchant_id
ON order_insurance_policies(merchant_id);

CREATE INDEX IF NOT EXISTS idx_order_insurance_policies_status
ON order_insurance_policies(status);

CREATE INDEX IF NOT EXISTS idx_order_insurance_policies_mycover_policy_id
ON order_insurance_policies(mycover_policy_id);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_order_insurance_policies_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_order_insurance_policies_updated_at ON order_insurance_policies;
CREATE TRIGGER trigger_order_insurance_policies_updated_at
    BEFORE UPDATE ON order_insurance_policies
    FOR EACH ROW
    EXECUTE FUNCTION update_order_insurance_policies_updated_at();

-- Enable RLS
ALTER TABLE order_insurance_policies ENABLE ROW LEVEL SECURITY;

-- Policy: Merchants can view their order insurance policies
CREATE POLICY "Merchants can view their order insurance policies"
ON order_insurance_policies
FOR SELECT
USING (
    merchant_id IN (
        SELECT id FROM merchants WHERE user_id = auth.uid()
    )
);

-- Policy: Service role can manage all policies (for webhooks and API)
CREATE POLICY "Service role can manage all order insurance policies"
ON order_insurance_policies
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Add comment for documentation
COMMENT ON TABLE order_insurance_policies IS 'Stores shipping insurance policies purchased via MyCover.ai for orders';
COMMENT ON COLUMN merchant_feature_settings.shipping_insurance_enabled IS 'When enabled, customers can opt to add shipping protection at checkout';
COMMENT ON COLUMN merchant_feature_settings.shipping_insurance_min_order_value IS 'Minimum order value (in store currency) to show insurance option';
COMMENT ON COLUMN merchant_feature_settings.shipping_insurance_opt_in_default IS 'If true, insurance checkbox is pre-selected at checkout';
