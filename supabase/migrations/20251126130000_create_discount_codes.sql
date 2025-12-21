-- Migration: Create discount codes system
-- Created: 2025-11-26
-- Description: Add discount codes table for promotional campaigns

-- Create discount_codes table
CREATE TABLE IF NOT EXISTS discount_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    description TEXT,
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
    discount_value DECIMAL(10, 2) NOT NULL CHECK (discount_value > 0),
    minimum_purchase_amount DECIMAL(10, 2) DEFAULT 0,
    maximum_discount_amount DECIMAL(10, 2),
    usage_limit INTEGER,
    usage_count INTEGER DEFAULT 0,
    usage_limit_per_customer INTEGER DEFAULT 1,
    starts_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    applies_to VARCHAR(20) DEFAULT 'all' CHECK (applies_to IN ('all', 'specific_products', 'specific_categories')),
    product_ids JSONB DEFAULT '[]'::jsonb,
    category_ids JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT unique_code_per_merchant UNIQUE (merchant_id, code)
);

-- Create discount_code_usage table to track who used what code
CREATE TABLE IF NOT EXISTS discount_code_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discount_code_id UUID NOT NULL REFERENCES discount_codes(id) ON DELETE CASCADE,
    customer_email VARCHAR(255) NOT NULL,
    order_id UUID,
    discount_amount DECIMAL(10, 2) NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT unique_customer_code UNIQUE (discount_code_id, customer_email)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_discount_codes_merchant_id ON discount_codes(merchant_id);
CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes(code);
CREATE INDEX IF NOT EXISTS idx_discount_codes_active ON discount_codes(is_active);
CREATE INDEX IF NOT EXISTS idx_discount_codes_expires_at ON discount_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_discount_code_usage_code_id ON discount_code_usage(discount_code_id);
CREATE INDEX IF NOT EXISTS idx_discount_code_usage_customer ON discount_code_usage(customer_email);

-- RLS Policies
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_code_usage ENABLE ROW LEVEL SECURITY;

-- Merchants can manage their own discount codes
CREATE POLICY "Merchants can manage their own discount codes"
    ON discount_codes
    FOR ALL
    USING (
        merchant_id IN (
            SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
        )
    );

-- Merchants can view usage of their discount codes
CREATE POLICY "Merchants can view their discount code usage"
    ON discount_code_usage
    FOR SELECT
    USING (
        discount_code_id IN (
            SELECT id FROM discount_codes WHERE merchant_id IN (
                SELECT id FROM merchants WHERE user_id = (SELECT auth.uid())
            )
        )
    );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_discount_code_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to update updated_at
CREATE TRIGGER update_discount_code_timestamp
    BEFORE UPDATE ON discount_codes
    FOR EACH ROW
    EXECUTE FUNCTION update_discount_code_updated_at();

COMMENT ON TABLE discount_codes IS 'Promotional discount codes for merchants';
COMMENT ON TABLE discount_code_usage IS 'Track usage of discount codes by customers';
