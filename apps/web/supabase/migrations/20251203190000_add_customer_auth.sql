-- Add customer authentication support
-- Customers use passwordless OTP (6-digit code via email) like Shopify's 2025 model

-- Add user_id to link customers to Supabase Auth (optional - guests won't have this)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Add auth provider tracking
ALTER TABLE customers ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'email';

-- Add address fields for saved addresses (JSON array of addresses)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS saved_addresses JSONB DEFAULT '[]'::jsonb;

-- Add last login timestamp
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Create index for faster user_id lookups
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id) WHERE user_id IS NOT NULL;

-- Create unique constraint: one user_id per merchant (a customer can have accounts at multiple merchants)
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_merchant_user ON customers(merchant_id, user_id) WHERE user_id IS NOT NULL;

-- Add comments
COMMENT ON COLUMN customers.user_id IS 'Links to Supabase Auth user. NULL for guest checkout customers.';
COMMENT ON COLUMN customers.auth_provider IS 'Authentication provider: email (OTP), google, facebook, etc.';
COMMENT ON COLUMN customers.saved_addresses IS 'JSON array of saved shipping addresses';
COMMENT ON COLUMN customers.last_login_at IS 'Timestamp of last customer login';

-- Update RLS policies to allow customers to view/update their own data
-- Drop existing policies first (if they exist from previous migrations)
DROP POLICY IF EXISTS "Customers can view their own data" ON customers;
DROP POLICY IF EXISTS "Customers can update their own data" ON customers;

-- Policy: Customers can view their own data
CREATE POLICY "Customers can view their own data"
  ON customers FOR SELECT
  USING (
    user_id = auth.uid()
    OR merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
  );

-- Policy: Customers can update their own data (limited fields via API)
CREATE POLICY "Customers can update their own data"
  ON customers FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create a function to handle customer upsert on OTP login
CREATE OR REPLACE FUNCTION public.upsert_customer_on_auth(
  p_merchant_id UUID,
  p_user_id UUID,
  p_email TEXT,
  p_full_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
BEGIN
  -- Try to find existing customer by email for this merchant
  SELECT id INTO v_customer_id
  FROM customers
  WHERE merchant_id = p_merchant_id AND email = p_email;

  IF v_customer_id IS NOT NULL THEN
    -- Update existing customer with user_id if not already set
    UPDATE customers
    SET
      user_id = COALESCE(user_id, p_user_id),
      full_name = COALESCE(p_full_name, full_name),
      phone = COALESCE(p_phone, phone),
      last_login_at = NOW(),
      updated_at = NOW()
    WHERE id = v_customer_id;
  ELSE
    -- Create new customer
    INSERT INTO customers (merchant_id, user_id, email, full_name, phone, last_login_at)
    VALUES (
      p_merchant_id,
      p_user_id,
      p_email,
      COALESCE(p_full_name, split_part(p_email, '@', 1)),
      p_phone,
      NOW()
    )
    RETURNING id INTO v_customer_id;
  END IF;

  RETURN v_customer_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.upsert_customer_on_auth TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_customer_on_auth TO service_role;
