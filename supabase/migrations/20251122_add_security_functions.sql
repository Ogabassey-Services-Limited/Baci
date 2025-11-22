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
  BEGIN
    SELECT stock_quantity INTO current_stock FROM products WHERE id = product_id_param FOR UPDATE NOWAIT;
  EXCEPTION
    WHEN lock_not_available THEN
      RETURN QUERY SELECT FALSE, -1, 'Product is locked by another transaction (NOWAIT), please try again';
      RETURN;
    WHEN deadlock_detected THEN
      RETURN QUERY SELECT FALSE, -1, 'Deadlock detected while acquiring product lock';
      RETURN;
  END;

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
  BEGIN
    SELECT stock_quantity INTO current_stock FROM product_variants WHERE id = variant_id_param FOR UPDATE NOWAIT;
  EXCEPTION
    WHEN lock_not_available THEN
      RETURN QUERY SELECT FALSE, -1, 'Variant is locked by another transaction (NOWAIT), please try again';
      RETURN;
    WHEN deadlock_detected THEN
      RETURN QUERY SELECT FALSE, -1, 'Deadlock detected while acquiring variant lock';
      RETURN;
  END;

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
-- TEXT SANITIZATION - REMOVED FOR SECURITY
-- =============================================
-- The sanitize_text_input function has been REMOVED from this migration.
--
-- Why removed:
--   Server-side regex-based HTML sanitization is fundamentally unsafe and creates
--   a dangerous security anti-pattern. Even with extensive warnings, the mere
--   existence of such a function in the codebase can lead to misuse by developers
--   who don't read the warnings, potentially causing XSS vulnerabilities.
--
-- PROPER security measures to use instead:
--   1. Store raw user input in the database (don't sanitize on input)
--   2. Use parameterized queries to prevent SQL injection
--   3. Sanitize at display time on the CLIENT side using:
--      - DOMPurify (https://github.com/cure53/DOMPurify)
--      - Framework auto-escaping (React JSX, Vue templates, Angular templates)
--   4. Implement Content Security Policy (CSP) headers
--   5. Use HTTP-only cookies for sensitive data
--
-- If you absolutely need server-side text cleanup (NOT for security):
--   Implement it in your application layer with clear documentation that
--   it provides cosmetic formatting only, never security.


-- =============================================
-- EMAIL VALIDATION FUNCTION
-- =============================================
CREATE OR REPLACE FUNCTION is_valid_email(email_text TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- RFC 5321/5322 compliant regex:
  -- Local part: one or more valid chars, followed by zero or more (dot + valid chars)
  -- This structure inherently prevents consecutive, leading, and trailing dots
  -- Supports common features: plus addressing (user+tag@), underscores, percent encoding
  --
  -- Domain part: RFC 1035 compliant - labels must start/end with alphanumeric
  -- Pattern: alphanumeric + optional (hyphens/alphanumeric) + alphanumeric
  IF email_text ~* '^[A-Za-z0-9_%+-]+(\.[A-Za-z0-9_%+-]+)*@[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$' THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;


-- =============================================
-- RATE LIMITING FUNCTION
-- =============================================
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
  affected_count INTEGER := 0;
  window_start TIMESTAMPTZ;
BEGIN
  -- Calculate aligned fixed window start (bucketed by window size)
  window_start := to_timestamp(
    floor(extract(epoch from now()) / window_seconds_param) * window_seconds_param
  );

  -- Try to insert a new row; if conflict, atomically increment only if under limit
  BEGIN
    INSERT INTO rate_limit_log (identifier, endpoint, request_count, window_start)
    VALUES (identifier_param, endpoint_param, 1, window_start);
    affected_count := 1; -- Insert succeeded, first request in window
  EXCEPTION WHEN unique_violation THEN
    -- Row exists, try to increment atomically only if below limit
    UPDATE rate_limit_log
    SET request_count = request_count + 1
    WHERE identifier = identifier_param
      AND endpoint = endpoint_param
      AND window_start = window_start
      AND request_count < max_requests_param;
    -- Check if update actually occurred (affected_count = 1 means allowed, 0 means limit reached)
    GET DIAGNOSTICS affected_count = ROW_COUNT;
  END;

  -- Return true only if insert or update succeeded (request is allowed)
  RETURN affected_count = 1;
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
  -- Input validation: days must be positive and reasonable
  IF days IS NULL OR days < 1 OR days > 365 THEN
    RAISE EXCEPTION 'days parameter must be between 1 and 365, got: %', days;
  END IF;

  DELETE FROM rate_limit_log
  WHERE window_start < NOW() - (days * INTERVAL '1 day');
END;
$$;


-- =============================================
-- GRANT PERMISSIONS
-- =============================================
-- Note: Stock decrement functions grant EXECUTE to 'authenticated' role, which is broad.
-- Security is enforced through Row Level Security (RLS) policies below, which ensure
-- users can only modify inventory for their own merchant accounts.
--
-- For stricter access control, consider:
--   1. Creating specific roles (e.g., 'inventory_manager', 'store_owner')
--   2. Revoking from 'authenticated' and granting only to those roles
--   3. Managing role assignments based on your application's access requirements
GRANT EXECUTE ON FUNCTION decrement_product_stock TO authenticated;
GRANT EXECUTE ON FUNCTION decrement_variant_stock TO authenticated;
GRANT EXECUTE ON FUNCTION is_valid_email TO authenticated, anon;
GRANT EXECUTE ON FUNCTION check_rate_limit TO authenticated, anon;
GRANT EXECUTE ON FUNCTION cleanup_rate_limit_log TO authenticated;


-- =============================================
-- ENABLE ROW LEVEL SECURITY & CREATE POLICIES FOR STOCK TABLES
-- =============================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

-- Note: No additional index needed - merchants.id primary key index is sufficient
-- The RLS policies use EXISTS which can leverage the PK index efficiently

-- Policy to ensure a user can only update products belonging to their own merchant account
-- Uses EXISTS for better performance than scalar subquery
CREATE POLICY update_own_product_stock ON products
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM merchants
    WHERE merchants.id = products.merchant_id
      AND merchants.user_id = auth.uid()
  ));

-- Policy to ensure a user can only update variants belonging to their own merchant account
-- Uses EXISTS for better performance than scalar subquery
CREATE POLICY update_own_variant_stock ON product_variants
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM merchants
    WHERE merchants.id = product_variants.merchant_id
      AND merchants.user_id = auth.uid()
  ));

