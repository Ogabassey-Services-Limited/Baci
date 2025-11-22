-- =============================================
-- ATOMIC STOCK UPDATE FUNCTIONS
-- =============================================
-- These functions ensure that stock is decremented atomically to prevent race conditions.
-- They lock the row, check for sufficient stock, and then update in a single transaction block.

CREATE OR REPLACE FUNCTION decrement_product_stock(
  product_id_param UUID,
  quantity_param INTEGER
)
RETURNS TABLE(success BOOLEAN, new_stock INTEGER, message TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
  current_stock INTEGER;
BEGIN
  -- Lock the product row and get current stock in one operation
  SELECT stock_quantity INTO current_stock FROM products WHERE id = product_id_param FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, -1, 'Product not found';
    RETURN;
  END IF;

  -- Check if stock is sufficient
  IF current_stock < quantity_param THEN
    RETURN QUERY SELECT FALSE, current_stock, 'Insufficient stock';
    RETURN;
  ELSE
    -- Decrement stock and return new quantity using RETURNING clause
    UPDATE products
    SET stock_quantity = stock_quantity - quantity_param,
        updated_at = NOW()
    WHERE id = product_id_param
    RETURNING stock_quantity INTO current_stock;

    RETURN QUERY SELECT TRUE, current_stock, 'Stock updated';
    RETURN;
  END IF;
END;
$$;


CREATE OR REPLACE FUNCTION decrement_variant_stock(
  variant_id_param UUID,
  quantity_param INTEGER
)
RETURNS TABLE(success BOOLEAN, new_stock INTEGER, message TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
  current_stock INTEGER;
BEGIN
  -- Lock the variant row and get current stock
  SELECT stock_quantity INTO current_stock FROM product_variants WHERE id = variant_id_param FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, -1, 'Variant not found';
    RETURN;
  END IF;

  -- Check stock
  IF current_stock < quantity_param THEN
    RETURN QUERY SELECT FALSE, current_stock, 'Insufficient stock';
    RETURN;
  ELSE
    -- Decrement stock and return new quantity
    UPDATE product_variants
    SET stock_quantity = stock_quantity - quantity_param,
        updated_at = NOW()
    WHERE id = variant_id_param
    RETURNING stock_quantity INTO current_stock;

    RETURN QUERY SELECT TRUE, current_stock, 'Stock updated';
    RETURN;
  END IF;
END;
$$;

-- =============================================
-- TEXT SANITIZATION FUNCTION
-- =============================================
-- WARNING:
-- This function uses regex-based HTML tag removal which may NOT catch all potential attack vectors,
-- including malformed or nested tags. For critical security use, sanitize on the client with a 
-- dedicated library (e.g., DOMPurify) or use external trusted sanitization solutions.
CREATE OR REPLACE FUNCTION sanitize_text_input(text_input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
  DECLARE
    cleaned TEXT;
  BEGIN
    -- Remove HTML tags (basic non-greedy pass; still limited)
    cleaned := regexp_replace(text_input, E'(?s)<.*?>', '', 'g');
    -- Remove javascript: and data: protocols
    cleaned := regexp_replace(cleaned, E'(?i)javascript:', '', 'g');
    cleaned := regexp_replace(cleaned, E'(?i)data:', '', 'g');
    -- Remove event handler attributes (onerror=, onload=, onclick=, etc.)
    cleaned := regexp_replace(cleaned, E'(?i)on\\w+\\s*=\\s*["\'][^"\']*["\']', '', 'g');
    RETURN btrim(cleaned);
  END;
$$;


-- =============================================
-- EMAIL VALIDATION FUNCTION
-- =============================================
-- WARNING:
-- This function uses a simplified regular expression for email validation.
-- It does NOT cover all valid email formats as per RFC 5322 and may reject some valid emails or accept some invalid ones.
-- For critical or production systems, consider additional or confirmational validation methods (such as sending a confirmation email).
CREATE OR REPLACE FUNCTION is_valid_email(email_text TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Improved validation: reject consecutive dots in local and domain parts using negative lookahead.
  IF email_text ~* '^(?!.*\.\.)[A-Za-z0-9](\.?[A-Za-z0-9_%+-])*@[A-Za-z0-9](\.?[A-Za-z0-9-])*\.[A-Za-z]{2,}$' THEN
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$;


-- =============================================
-- RATE LIMITING FUNCTION
-- =============================================
-- Creates a fixed-window rate limiter. Returns TRUE if request is allowed, FALSE if blocked.
CREATE OR REPLACE FUNCTION check_rate_limit(
  identifier_param TEXT,
  endpoint_param TEXT,
  max_requests_param INTEGER,
  window_seconds_param INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  current_count INTEGER;
  window_start TIMESTAMPTZ;
BEGIN
  -- Calculate aligned fixed window start (bucketed by window size)
  window_start := to_timestamp(
    floor(extract(epoch from now()) / window_seconds_param) * window_seconds_param
  );

  -- Get current count for this window
  SELECT SUM(request_count) INTO current_count
  FROM rate_limit_log
  WHERE identifier = identifier_param
    AND endpoint = endpoint_param
    AND rate_limit_log.window_start = window_start;

  IF current_count IS NULL THEN
    current_count := 0;
  END IF;

  IF current_count >= max_requests_param THEN
    RETURN FALSE; -- Block request
  END IF;

  -- Log this request and increment count on conflict
  INSERT INTO rate_limit_log (identifier, endpoint, request_count, window_start)
  VALUES (identifier_param, endpoint_param, 1, window_start)
  ON CONFLICT (identifier, endpoint, window_start) DO UPDATE
    SET request_count = rate_limit_log.request_count + 1;

  RETURN TRUE;
END;
$$;

-- =============================================
-- RATE LIMIT LOG CLEANUP FUNCTION
-- =============================================
-- Deletes rate_limit_log entries older than the specified number of days (default: 1)
CREATE OR REPLACE FUNCTION cleanup_rate_limit_log(days INTEGER DEFAULT 1)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM rate_limit_log
  WHERE created_at < NOW() - (days * INTERVAL '1 day');
END;
$$;


-- =============================================
-- GRANT PERMISSIONS
-- =============================================
-- Allow only authorized roles to call decrement_product_stock. 
GRANT EXECUTE ON FUNCTION decrement_product_stock TO authenticated;
-- TODO: Ensure authorization logic (or Row Level Security) restricts stock changes by user ownership!
GRANT EXECUTE ON FUNCTION decrement_variant_stock TO authenticated;
GRANT EXECUTE ON FUNCTION sanitize_text_input TO authenticated, anon;
GRANT EXECUTE ON FUNCTION is_valid_email TO authenticated, anon;
GRANT EXECUTE ON FUNCTION check_rate_limit TO authenticated, anon;
GRANT EXECUTE ON FUNCTION cleanup_rate_limit_log TO authenticated;
