-- =============================================
-- ATOMIC STOCK UPDATE FUNCTIONS
-- =============================================
-- These functions ensure that stock levels are updated atomically to prevent race conditions.

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
  -- Lock the product row and get current stock, fail immediately if locked
  SELECT stock_quantity INTO current_stock FROM products WHERE id = product_id_param FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, -1, 'Product not found';
    RETURN;
  END IF;

  -- Check if stock is sufficient
  IF current_stock < quantity_param THEN
    RETURN QUERY SELECT FALSE, current_stock, 'Insufficient stock';
    RETURN;
  ELSE
    -- Decrement stock and return new quantity
    RETURN QUERY
    UPDATE products
    SET stock_quantity = stock_quantity - quantity_param,
        updated_at = NOW()
    WHERE id = product_id_param
    RETURNING TRUE, stock_quantity, 'Stock updated';
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
  -- Lock the variant row and get current stock, fail immediately if locked
  SELECT stock_quantity INTO current_stock FROM product_variants WHERE id = variant_id_param FOR UPDATE NOWAIT;

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
    RETURN QUERY
    UPDATE product_variants
    SET stock_quantity = stock_quantity - quantity_param,
        updated_at = NOW()
    WHERE id = variant_id_param
    RETURNING TRUE, stock_quantity, 'Stock updated';
    RETURN;
  END IF;
END;
$$;


-- =============================================
-- TEXT SANITIZATION FUNCTION (UNSAFE - DO NOT USE FOR SECURITY)
-- =============================================
-- WARNING:
-- !!! This function is NOT SAFE for security-critical input. !!!
-- Regex-based HTML tag removal is easily bypassed by malformed, nested, or multiline tags.
-- Never use server-side regex for XSS prevention!
-- For any untrusted input, use a dedicated client-side library (e.g., DOMPurify).
-- This function is for basic display formatting only, NOT security!
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION sanitize_text_input(text_input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
  DECLARE
    cleaned TEXT;
  BEGIN
    -- Remove HTML tags: updated regex to avoid multiline/nested tag match, but still NOT SAFE
    cleaned := regexp_replace(text_input, E'<[^>\\n]+>', '', 'g');
    -- Remove HTML tags that span newlines (using 'n' flag)
    cleaned := regexp_replace(cleaned, E'<.*?>', '', 'gn');
    -- Remove javascript: and data: protocols
    cleaned := regexp_replace(cleaned, E'(?i)javascript:', '', 'g');
    cleaned := regexp_replace(cleaned, E'(?i)data:', '', 'g');
    -- Remove event handler attributes (onerror=, onload=, onclick=, etc.) - updated regex
    cleaned := regexp_replace(cleaned, E'(?i)on\\w+\\s*=\\s*(?:"[^"]*"|\'[^\']*\'|[^\\s>]+)', '', 'g');
    RETURN btrim(cleaned);
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
  -- Reject consecutive dots (defense in depth)
  IF POSITION('..' IN email_text) > 0 THEN
    RETURN FALSE;
  END IF;

  -- RFC 5321/5322 compliant regex:
  -- Local part: one or more valid chars, followed by zero or more (dot + valid chars)
  -- This ensures dots are always between characters, preventing consecutive/leading/trailing dots
  IF email_text ~* '^[A-Za-z0-9_%+-]+(\.[A-Za-z0-9_%+-]+)*@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$' THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;


-- =============================================
-- RATE LIMITING FUNCTIONS
-- =============================================
CREATE OR REPLACE FUNCTION check_rate_limit(
  identifier_param TEXT,
  endpoint_param TEXT,
  max_requests_param INT,
  window_seconds_param INT
)
RETURNS TABLE(allowed BOOLEAN, count INT, reset_time TIMESTAMPTZ)
LANGUAGE plpgsql
AS $$
DECLARE
  current_count INT;
  window_start TIMESTAMPTZ;
BEGIN
  window_start := NOW() - (window_seconds_param * INTERVAL '1 second');
  
  SELECT COUNT(*)
  INTO current_count
  FROM rate_limit_log
  WHERE identifier = identifier_param
    AND endpoint = endpoint_param
    AND created_at >= window_start;

  INSERT INTO rate_limit_log (identifier, endpoint)
  VALUES (identifier_param, endpoint_param);

  IF current_count < max_requests_param THEN
    RETURN QUERY SELECT TRUE, current_count + 1, window_start + (window_seconds_param * INTERVAL '1 second');
  ELSE
    RETURN QUERY SELECT FALSE, current_count + 1, window_start + (window_seconds_param * INTERVAL '1 second');
  END IF;
END;
$$;


CREATE OR REPLACE FUNCTION cleanup_rate_limit_log()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limit_log WHERE created_at < NOW() - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql;


-- =============================================
-- GRANT PERMISSIONS
-- =============================================
-- Allow only authorized roles to call these functions
GRANT EXECUTE ON FUNCTION decrement_product_stock TO authenticated;
GRANT EXECUTE ON FUNCTION decrement_variant_stock TO authenticated;
GRANT EXECUTE ON FUNCTION is_valid_email TO authenticated, anon;
GRANT EXECUTE ON FUNCTION check_rate_limit TO authenticated, anon;
GRANT EXECUTE ON FUNCTION cleanup_rate_limit_log TO authenticated;

-- Explicitly prevent 'anon' role from executing this UNSAFE function
REVOKE EXECUTE ON FUNCTION sanitize_text_input(text) FROM anon;
REVOKE EXECUTE ON FUNCTION sanitize_text_input(text) FROM authenticated;


-- =============================================
-- ENABLE ROW LEVEL SECURITY & CREATE POLICIES FOR STOCK TABLES
-- =============================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

-- Policy to ensure a user can only update products belonging to their own merchant account
CREATE POLICY update_own_product_stock ON products
  FOR UPDATE
  USING (((SELECT user_id FROM merchants WHERE id = products.merchant_id) = auth.uid()));

-- Policy to ensure a user can only update variants belonging to their own merchant account
CREATE POLICY update_own_variant_stock ON product_variants
  FOR UPDATE
  USING (((SELECT user_id FROM merchants WHERE id = product_variants.merchant_id) = auth.uid()));

