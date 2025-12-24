-- Multi-Currency Support for African Markets
-- Supports: NGN (Nigeria), KES (Kenya), GHS (Ghana), ZAR (South Africa), XAF (Cameroon), XOF (Ivory Coast)

-- Add currency settings to merchants
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS payout_currency TEXT DEFAULT 'NGN';
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS multi_currency_enabled BOOLEAN DEFAULT true;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS bank_account_name TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS bank_account_number TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS bank_code TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS bank_name TEXT;

-- Create merchant balances table for tracking earnings per currency
CREATE TABLE IF NOT EXISTS merchant_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    currency TEXT NOT NULL CHECK (currency IN ('NGN', 'KES', 'GHS', 'ZAR', 'XAF', 'XOF', 'USD', 'GBP')),
    available_balance DECIMAL(15, 2) DEFAULT 0.00,
    pending_balance DECIMAL(15, 2) DEFAULT 0.00,
    total_earned DECIMAL(15, 2) DEFAULT 0.00,
    total_withdrawn DECIMAL(15, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(merchant_id, currency)
);

-- Create index for quick balance lookups
CREATE INDEX IF NOT EXISTS idx_merchant_balances_merchant_id ON merchant_balances(merchant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_balances_currency ON merchant_balances(merchant_id, currency);

-- Create transactions table for tracking all financial movements
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('payment', 'payout', 'refund', 'fee', 'conversion')),
    amount DECIMAL(15, 2) NOT NULL,
    currency TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),

    -- Payment gateway details
    gateway TEXT DEFAULT 'korapay',
    gateway_reference TEXT,
    gateway_response JSONB,

    -- Description and metadata
    description TEXT,
    metadata JSONB,

    -- Platform fee tracking
    platform_fee DECIMAL(15, 2) DEFAULT 0.00,
    merchant_amount DECIMAL(15, 2), -- Amount after platform fee

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_merchant_id ON transactions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_order_id ON transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_gateway_reference ON transactions(gateway_reference);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);

-- Create payout requests table
CREATE TABLE IF NOT EXISTS payout_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL,
    currency TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),

    -- Bank details
    bank_account_name TEXT NOT NULL,
    bank_account_number TEXT NOT NULL,
    bank_code TEXT NOT NULL,
    bank_name TEXT,

    -- Korapay details
    korapay_reference TEXT,
    korapay_response JSONB,

    -- Failure handling
    failure_reason TEXT,
    retry_count INTEGER DEFAULT 0,

    -- Timestamps
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payout_requests_merchant_id ON payout_requests(merchant_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status);
CREATE INDEX IF NOT EXISTS idx_payout_requests_korapay_reference ON payout_requests(korapay_reference);

-- Add currency to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'NGN';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(10, 4);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS original_currency TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS original_total DECIMAL(10, 2);

-- Function to update merchant balance
CREATE OR REPLACE FUNCTION update_merchant_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        IF NEW.transaction_type = 'payment' THEN
            -- Add to merchant balance (payment received)
            INSERT INTO merchant_balances (merchant_id, currency, available_balance, total_earned)
            VALUES (NEW.merchant_id, NEW.currency, NEW.merchant_amount, NEW.merchant_amount)
            ON CONFLICT (merchant_id, currency)
            DO UPDATE SET
                available_balance = merchant_balances.available_balance + NEW.merchant_amount,
                total_earned = merchant_balances.total_earned + NEW.merchant_amount,
                updated_at = NOW();

        ELSIF NEW.transaction_type = 'payout' THEN
            -- Deduct from merchant balance (payout processed)
            UPDATE merchant_balances
            SET
                available_balance = available_balance - NEW.amount,
                total_withdrawn = total_withdrawn + NEW.amount,
                updated_at = NOW()
            WHERE merchant_id = NEW.merchant_id AND currency = NEW.currency;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update balances
DROP TRIGGER IF EXISTS trigger_update_merchant_balance ON transactions;
CREATE TRIGGER trigger_update_merchant_balance
    AFTER UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_merchant_balance();

-- Function to get merchant available balance
CREATE OR REPLACE FUNCTION get_merchant_balance(merchant_id_param UUID, currency_param TEXT)
RETURNS DECIMAL AS $$
DECLARE
    balance DECIMAL;
BEGIN
    SELECT COALESCE(available_balance, 0.00) INTO balance
    FROM merchant_balances
    WHERE merchant_id = merchant_id_param AND currency = currency_param;

    RETURN COALESCE(balance, 0.00);
END;
$$ LANGUAGE plpgsql;

-- RLS Policies for merchant_balances
ALTER TABLE merchant_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can view their own balances"
    ON merchant_balances FOR SELECT
    USING (merchant_id IN (
        SELECT id FROM merchants WHERE user_id = auth.uid()
    ));

-- RLS Policies for transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can view their own transactions"
    ON transactions FOR SELECT
    USING (merchant_id IN (
        SELECT id FROM merchants WHERE user_id = auth.uid()
    ));

-- RLS Policies for payout_requests
ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can view their own payout requests"
    ON payout_requests FOR SELECT
    USING (merchant_id IN (
        SELECT id FROM merchants WHERE user_id = auth.uid()
    ));

CREATE POLICY "Merchants can create their own payout requests"
    ON payout_requests FOR INSERT
    WITH CHECK (merchant_id IN (
        SELECT id FROM merchants WHERE user_id = auth.uid()
    ));
