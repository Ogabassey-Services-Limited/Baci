-- =============================================
-- DECREMENT PRODUCT STOCK
-- Safely decrements stock for a base product.
-- =============================================
CREATE OR REPLACE FUNCTION decrement_product_stock(
  product_id_param UUID,
  quantity_param INTEGER
)
RETURNS TABLE(success BOOLEAN, new_stock INTEGER, message TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
  current_stock INTEGER;
  updated_stock INTEGER;
BEGIN
  -- Row-level lock on the product to prevent race conditions
  SELECT stock_quantity INTO current_stock FROM products WHERE id = product_id_param FOR UPDATE;

  IF current_stock IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 'Product not found';
    RETURN;
  END IF;

  IF current_stock < quantity_param THEN
    RETURN QUERY SELECT FALSE, current_stock, 'Insufficient stock';
    RETURN;
  END IF;

  UPDATE products
  SET
    stock_quantity = stock_quantity - quantity_param,
    updated_at = NOW()
  WHERE id = product_id_param
  RETURNING stock_quantity INTO updated_stock;

  RETURN QUERY SELECT TRUE, updated_stock, 'Stock updated successfully';
END;
$$;


-- =============================================
-- DECREMENT VARIANT STOCK
-- Safely decrements stock for a product variant.
-- =============================================
CREATE OR REPLACE FUNCTION decrement_variant_stock(
  variant_id_param UUID,
  quantity_param INTEGER
)
RETURNS TABLE(success BOOLEAN, new_stock INTEGER, message TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
  current_stock INTEGER;
  updated_stock INTEGER;
BEGIN
  SELECT stock_quantity INTO current_stock FROM product_variants WHERE id = variant_id_param FOR UPDATE;

  IF current_stock IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 'Variant not found';
    RETURN;
  END IF;

  IF current_stock < quantity_param THEN
    RETURN QUERY SELECT FALSE, current_stock, 'Insufficient stock for variant';
    RETURN;
  END IF;

  UPDATE product_variants
  SET stock_quantity = stock_quantity - quantity_param,
      updated_at = NOW()
  WHERE id = variant_id_param
  RETURNING stock_quantity INTO updated_stock;

  RETURN QUERY SELECT TRUE, updated_stock, 'Variant stock updated successfully';
END;
$$;


-- =============================================
-- SANITIZE TEXT INPUT
-- Basic text sanitization to prevent XSS.
-- =============================================
CREATE OR REPLACE FUNCTION sanitize_text_input(text_input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN btrim(regexp_replace(text_input, E'<[^>]+>', '', 'g'));
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
  -- The following regex is intentionally simple and does not cover all valid addresses per RFC 5322.
  RETURN email_text ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
END;
$$;


-- =============================================
-- RATE LIMITING FUNCTION
-- =============================================
CREATE TABLE IF NOT EXISTS rate_limit_log (
    id BIGSERIAL PRIMARY KEY,
    identifier TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 1,
    window_start TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(identifier, endpoint, window_start)
);

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
  window_start := NOW() - (window_seconds_param * INTERVAL '1 second');

  -- Get current count for this window
  SELECT SUM(request_count) INTO current_count
  FROM rate_limit_log
  WHERE identifier = identifier_param
    AND endpoint = endpoint_param
    AND created_at >= window_start;

  IF current_count IS NULL THEN
    current_count := 0;
  END IF;

  IF current_count >= max_requests_param THEN
    RETURN FALSE; -- Rate limit exceeded
  END IF;

  -- Log this request and increment count on conflict
  INSERT INTO rate_limit_log (identifier, endpoint, request_count, window_start)
  VALUES (identifier_param, endpoint_param, 1, NOW())
  ON CONFLICT (identifier, endpoint, window_start) DO UPDATE
    SET request_count = rate_limit_log.request_count + 1;

  RETURN TRUE;
END;
$$;


-- =============================================
-- GRANT PERMISSIONS
-- =============================================
-- Allow authenticated users to call these functions
GRANT EXECUTE ON FUNCTION decrement_product_stock TO authenticated;
GRANT EXECUTE ON FUNCTION decrement_variant_stock TO authenticated;
GRANT EXECUTE ON FUNCTION sanitize_text_input TO authenticated, anon;
GRANT EXECUTE ON FUNCTION is_valid_email TO authenticated, anon;
GRANT EXECUTE ON FUNCTION check_rate_limit TO authenticated, anon;
