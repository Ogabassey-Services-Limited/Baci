-- Security Enhancement Migration
-- Date: 2025-11-22
-- Purpose: Add atomic stock updates and security functions

-- =============================================
-- ATOMIC STOCK UPDATE FUNCTION
-- =============================================
-- This function ensures atomic stock updates to prevent race conditions
CREATE OR REPLACE FUNCTION decrement_product_stock(
  product_id_param UUID,
  quantity_param INTEGER
)
RETURNS TABLE(success BOOLEAN, new_stock INTEGER, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_stock INTEGER;
  updated_stock INTEGER;
BEGIN
  -- Lock the row for update to prevent race conditions
  SELECT stock_quantity INTO current_stock
  FROM products
  WHERE id = product_id_param
  FOR UPDATE;

  -- Check if product exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0, 'Product not found';
    RETURN;
  END IF;

  -- Check if we have enough stock
  IF current_stock < quantity_param THEN
    RETURN QUERY SELECT FALSE, current_stock, 'Insufficient stock';
    RETURN;
  END IF;

  -- Update the stock atomically
  UPDATE products
  SET stock_quantity = stock_quantity - quantity_param,
      updated_at = NOW()
  WHERE id = product_id_param
  RETURNING stock_quantity INTO updated_stock;

  RETURN QUERY SELECT TRUE, updated_stock, 'Stock updated successfully';
END;
$$;

-- =============================================
-- VARIANT STOCK UPDATE FUNCTION
-- =============================================
CREATE OR REPLACE FUNCTION decrement_variant_stock(
  variant_id_param UUID,
  quantity_param INTEGER
)
RETURNS TABLE(success BOOLEAN, new_stock INTEGER, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_stock INTEGER;
  updated_stock INTEGER;
BEGIN
  -- Lock the row for update
  SELECT stock_quantity INTO current_stock
  FROM product_variants
  WHERE id = variant_id_param
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0, 'Variant not found';
    RETURN;
  END IF;

  IF current_stock < quantity_param THEN
    RETURN QUERY SELECT FALSE, current_stock, 'Insufficient stock';
    RETURN;
  END IF;

  UPDATE product_variants
  SET stock_quantity = stock_quantity - quantity_param
  WHERE id = variant_id_param
  RETURNING stock_quantity INTO updated_stock;

  RETURN QUERY SELECT TRUE, updated_stock, 'Stock updated successfully';
END;
$$;

-- =============================================
-- INPUT SANITIZATION FUNCTION
-- =============================================
-- Sanitize text input to prevent XSS and injection attacks
CREATE OR REPLACE FUNCTION sanitize_text_input(input_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Remove null bytes
  input_text := REPLACE(input_text, E'\x00', '');
  
  -- Trim whitespace
  input_text := TRIM(input_text);
  
  -- Limit length to prevent DoS
  IF LENGTH(input_text) > 10000 THEN
    input_text := SUBSTRING(input_text, 1, 10000);
  END IF;
  
  RETURN input_text;
END;
$$;

-- =============================================
-- EMAIL VALIDATION FUNCTION
-- =============================================
CREATE OR REPLACE FUNCTION is_valid_email(email_text TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN email_text ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
END;
$$;

-- =============================================
-- RATE LIMITING TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS rate_limit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  identifier TEXT NOT NULL, -- IP address or user ID
  endpoint TEXT NOT NULL,
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_rate_limit_identifier_endpoint 
  ON rate_limit_log(identifier, endpoint, window_start);

-- =============================================
-- RATE LIMITING FUNCTION
-- =============================================
-- Check if request should be rate limited (returns true if allowed)
CREATE OR REPLACE FUNCTION check_rate_limit(
  identifier_param TEXT,
  endpoint_param TEXT,
  max_requests INTEGER DEFAULT 100,
  window_minutes INTEGER DEFAULT 1
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  current_count INTEGER;
  window_start_time TIMESTAMP WITH TIME ZONE;
BEGIN
  window_start_time := NOW() - (window_minutes || ' minutes')::INTERVAL;
  
  -- Get current request count in the window
  SELECT COALESCE(SUM(request_count), 0) INTO current_count
  FROM rate_limit_log
  WHERE identifier = identifier_param
    AND endpoint = endpoint_param
    AND window_start > window_start_time;
  
  -- Check if limit exceeded
  IF current_count >= max_requests THEN
    RETURN FALSE;
  END IF;
  
  -- Log this request
  INSERT INTO rate_limit_log (identifier, endpoint, request_count, window_start)
  VALUES (identifier_param, endpoint_param, 1, NOW())
  ON CONFLICT DO NOTHING;
  
  RETURN TRUE;
END;
$$;

-- =============================================
-- CLEANUP OLD RATE LIMIT LOGS
-- =============================================
-- Function to clean up old rate limit logs (run periodically)
CREATE OR REPLACE FUNCTION cleanup_rate_limit_logs()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM rate_limit_log
  WHERE created_at < NOW() - INTERVAL '1 hour';
END;
$$;

-- =============================================
-- GRANT PERMISSIONS
-- =============================================
-- Allow authenticated users to call these functions
GRANT EXECUTE ON FUNCTION decrement_product_stock TO authenticated, anon;
GRANT EXECUTE ON FUNCTION decrement_variant_stock TO authenticated, anon;
GRANT EXECUTE ON FUNCTION sanitize_text_input TO authenticated, anon;
GRANT EXECUTE ON FUNCTION is_valid_email TO authenticated, anon;
GRANT EXECUTE ON FUNCTION check_rate_limit TO authenticated, anon;

-- =============================================
-- COMMENTS
-- =============================================
COMMENT ON FUNCTION decrement_product_stock IS 'Atomically decrements product stock with row-level locking to prevent race conditions';
COMMENT ON FUNCTION decrement_variant_stock IS 'Atomically decrements variant stock with row-level locking';
COMMENT ON FUNCTION sanitize_text_input IS 'Sanitizes text input to prevent XSS and injection attacks';
COMMENT ON FUNCTION is_valid_email IS 'Validates email format using regex';
COMMENT ON FUNCTION check_rate_limit IS 'Checks if a request should be rate limited based on identifier and endpoint';
