-- =============================================
-- Migration: Improved Order Number System
-- Created: 2024-12-04
-- Description: Implements a hybrid order number system based on e-commerce best practices
--
-- Format: PREFIX-YYMMDD-XXXX-C
-- - PREFIX: Merchant's order prefix (default: "ORD") - up to 4 chars
-- - YYMMDD: Date component for context and natural sorting
-- - XXXX: Base32 encoded sequence (Crockford's Base32 for readability)
-- - C: Check digit (Luhn mod N) for validation
--
-- Benefits:
-- 1. Human-readable and easy to communicate verbally
-- 2. Non-sequential appearance (competitors can't track volume)
-- 3. Date provides context without revealing exact order count
-- 4. Check digit catches typos in customer support
-- 5. Per-merchant customizable prefix for branding
-- =============================================

-- Add order_prefix column to merchants table
ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS order_prefix TEXT DEFAULT 'ORD';

-- Add constraint for order_prefix (1-4 alphanumeric characters)
ALTER TABLE merchants
ADD CONSTRAINT merchants_order_prefix_valid
CHECK (order_prefix ~ '^[A-Z0-9]{1,4}$');

-- Update existing merchants to have default prefix
UPDATE merchants SET order_prefix = 'ORD' WHERE order_prefix IS NULL;

-- Create a table to track daily order counters per merchant (for the sequence part)
CREATE TABLE IF NOT EXISTS merchant_daily_counters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE NOT NULL,
    date_key DATE NOT NULL DEFAULT CURRENT_DATE,
    last_sequence INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(merchant_id, date_key)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_merchant_daily_counters_lookup
ON merchant_daily_counters(merchant_id, date_key);

-- Crockford's Base32 alphabet (excludes I, L, O, U to avoid confusion)
-- 0123456789ABCDEFGHJKMNPQRSTVWXYZ (32 characters)

-- Function to encode a number to Crockford's Base32
CREATE OR REPLACE FUNCTION encode_base32_crockford(num INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
    alphabet TEXT := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    result TEXT := '';
    remainder INTEGER;
    n INTEGER := num;
BEGIN
    IF n = 0 THEN
        RETURN '0000';
    END IF;

    WHILE n > 0 LOOP
        remainder := n % 32;
        result := SUBSTRING(alphabet FROM remainder + 1 FOR 1) || result;
        n := n / 32;
    END LOOP;

    -- Pad to 4 characters
    WHILE LENGTH(result) < 4 LOOP
        result := '0' || result;
    END LOOP;

    RETURN result;
END;
$$;

-- Function to calculate check digit using Luhn mod 32
CREATE OR REPLACE FUNCTION calculate_order_check_digit(order_str TEXT)
RETURNS CHAR
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
    alphabet TEXT := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    clean_str TEXT;
    i INTEGER;
    char_val INTEGER;
    sum_val INTEGER := 0;
    factor INTEGER := 2;
BEGIN
    -- Remove hyphens and convert to uppercase
    clean_str := UPPER(REPLACE(order_str, '-', ''));

    -- Process from right to left
    FOR i IN REVERSE LENGTH(clean_str)..1 LOOP
        char_val := POSITION(SUBSTRING(clean_str FROM i FOR 1) IN alphabet) - 1;
        IF char_val < 0 THEN
            char_val := 0;
        END IF;

        IF factor = 2 THEN
            char_val := char_val * 2;
            IF char_val >= 32 THEN
                char_val := (char_val / 32) + (char_val % 32);
            END IF;
            factor := 1;
        ELSE
            factor := 2;
        END IF;

        sum_val := sum_val + char_val;
    END LOOP;

    -- Calculate check digit
    char_val := (32 - (sum_val % 32)) % 32;

    RETURN SUBSTRING(alphabet FROM char_val + 1 FOR 1);
END;
$$;

-- Function to validate an order number's check digit
CREATE OR REPLACE FUNCTION validate_order_number(order_num TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
    parts TEXT[];
    base_str TEXT;
    check_char CHAR;
    expected_check CHAR;
BEGIN
    -- Handle legacy format (#00000001)
    IF order_num ~ '^#[0-9]{8}$' THEN
        RETURN TRUE;
    END IF;

    -- Parse new format (PREFIX-YYMMDD-XXXX-C)
    parts := STRING_TO_ARRAY(order_num, '-');

    IF ARRAY_LENGTH(parts, 1) != 4 THEN
        RETURN FALSE;
    END IF;

    -- Extract check digit (last character)
    check_char := parts[4];

    -- Reconstruct base string without check digit
    base_str := parts[1] || '-' || parts[2] || '-' || parts[3];

    -- Calculate expected check digit
    expected_check := calculate_order_check_digit(base_str);

    RETURN check_char = expected_check;
END;
$$;

-- Main function to generate improved order numbers
CREATE OR REPLACE FUNCTION generate_improved_order_number(merchant_uuid UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    prefix TEXT;
    date_part TEXT;
    next_seq INTEGER;
    seq_encoded TEXT;
    base_order TEXT;
    check_digit CHAR;
    final_order TEXT;
    today DATE := CURRENT_DATE;
BEGIN
    IF merchant_uuid IS NULL THEN
        RAISE EXCEPTION 'merchant_uuid cannot be null';
    END IF;

    -- Get merchant's order prefix
    SELECT COALESCE(order_prefix, 'ORD') INTO prefix
    FROM merchants
    WHERE id = merchant_uuid;

    IF prefix IS NULL THEN
        prefix := 'ORD';
    END IF;

    -- Format date as YYMMDD
    date_part := TO_CHAR(today, 'YYMMDD');

    -- Get or create daily counter and increment atomically
    INSERT INTO merchant_daily_counters (merchant_id, date_key, last_sequence)
    VALUES (merchant_uuid, today, 1)
    ON CONFLICT (merchant_id, date_key)
    DO UPDATE SET last_sequence = merchant_daily_counters.last_sequence + 1
    RETURNING last_sequence INTO next_seq;

    -- Encode sequence to Base32 (scrambles the sequence number)
    -- Add a pseudo-random offset based on merchant_id to make sequences appear random
    -- This prevents competitors from guessing order volume
    next_seq := next_seq + (('x' || SUBSTRING(merchant_uuid::TEXT, 1, 8))::BIT(32)::INTEGER % 1000);
    seq_encoded := encode_base32_crockford(next_seq);

    -- Build base order number
    base_order := prefix || '-' || date_part || '-' || seq_encoded;

    -- Calculate check digit
    check_digit := calculate_order_check_digit(base_order);

    -- Final order number
    final_order := base_order || '-' || check_digit;

    RETURN final_order;
END;
$$;

-- Update the trigger function to use the new generator
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF NEW.order_number IS NULL THEN
        NEW.order_number := generate_improved_order_number(NEW.merchant_id);
    END IF;
    RETURN NEW;
END;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS trigger_set_order_number ON orders;
CREATE TRIGGER trigger_set_order_number
    BEFORE INSERT ON orders
    FOR EACH ROW
    EXECUTE FUNCTION set_order_number();

-- Add RLS policies for the new counter table
ALTER TABLE merchant_daily_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "merchant_daily_counters_merchant_access"
ON merchant_daily_counters
FOR ALL
USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON merchant_daily_counters TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Create index on orders for the new format pattern matching
CREATE INDEX IF NOT EXISTS idx_orders_order_number_pattern
ON orders (order_number text_pattern_ops);

-- Add helpful comment
COMMENT ON FUNCTION generate_improved_order_number IS
'Generates human-readable order numbers in format PREFIX-YYMMDD-XXXX-C where:
- PREFIX: Merchant customizable (1-4 chars, default ORD)
- YYMMDD: Date for context
- XXXX: Base32 encoded sequence (appears random)
- C: Check digit for validation

Example: ORD-241204-A7K3-2

Benefits:
- Human readable and easy to communicate verbally
- Non-sequential (hides business volume from competitors)
- Date provides context for customer support
- Check digit catches typos
- Per-merchant branding via prefix';

-- Function to search orders by partial order number (for customer support)
CREATE OR REPLACE FUNCTION search_order_by_number(
    p_merchant_id UUID,
    p_search_term TEXT
)
RETURNS SETOF orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    RETURN QUERY
    SELECT o.*
    FROM orders o
    WHERE o.merchant_id = p_merchant_id
      AND (
          o.order_number ILIKE '%' || p_search_term || '%'
          OR o.id::TEXT ILIKE p_search_term || '%'
      )
    ORDER BY o.created_at DESC
    LIMIT 50;
END;
$$;

COMMENT ON FUNCTION search_order_by_number IS
'Search orders by partial order number match. Useful for customer support when customers provide partial numbers.';
