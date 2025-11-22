-- =============================================
-- ATOMIC STOCK DECREMENT FUNCTIONS
-- =============================================
-- These functions ensure that stock updates are atomic and prevent race conditions.

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
  -- Lock the product row and get current stock
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
    RETURN QUERY 
    UPDATE products
    SET stock_quantity = products.stock_quantity - quantity_param,
        updated_at = NOW()
    WHERE id = product_id_param
    RETURNING TRUE, products.stock_quantity, 'Stock updated';
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
    -- Decrement stock and return new quantity using RETURNING clause
    RETURN QUERY
    UPDATE product_variants
    SET stock_quantity = product_variants.stock_quantity - quantity_param,
        updated_at = NOW()
    WHERE id = variant_id_param
    RETURNING TRUE, product_variants.stock_quantity, 'Stock updated';
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
-- Validates email addresses according to RFC 5321/5322 standards (2025)
-- Checks:
--   - Length limits (max 320 chars total, 64 for local, 255 for domain)
--   - No consecutive dots
--   - No leading/trailing dots
--   - Proper structure: local@domain.tld
CREATE OR REPLACE FUNCTION is_valid_email(email_text TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  trimmed_email TEXT;
  local_part TEXT;
  domain_part TEXT;
  at_position INTEGER;
BEGIN
  -- Handle NULL or empty input
  IF email_text IS NULL OR length(btrim(email_text)) = 0 THEN
    RETURN FALSE;
  END IF;

  -- Trim whitespace
  trimmed_email := btrim(email_text);

  -- Check overall length (RFC 5321: max 320 characters)
  IF length(trimmed_email) > 320 THEN
    RETURN FALSE;
  END IF;

  -- Check for exactly one @ symbol
  at_position := POSITION('@' IN trimmed_email);
  IF at_position = 0 OR POSITION('@' IN substring(trimmed_email FROM at_position + 1)) > 0 THEN
    RETURN FALSE;
  END IF;

  -- Split into local and domain parts
  local_part := substring(trimmed_email FROM 1 FOR at_position - 1);
  domain_part := substring(trimmed_email FROM at_position + 1);

  -- Check local part length (RFC 5321: max 64 characters)
  IF length(local_part) = 0 OR length(local_part) > 64 THEN
    RETURN FALSE;
  END IF;

  -- Check domain part length (RFC 5321: max 255 characters)
  IF length(domain_part) = 0 OR length(domain_part) > 255 THEN
    RETURN FALSE;
  END IF;

  -- Reject consecutive dots anywhere
  IF POSITION('..' IN trimmed_email) > 0 THEN
    RETURN FALSE;
  END IF;

  -- Reject leading or trailing dots in local part
  IF local_part ~ '^\.' OR local_part ~ '\.$' THEN
    RETURN FALSE;
  END IF;

  -- Reject leading or trailing dots in domain part
  IF domain_part ~ '^\.' OR domain_part ~ '\.$' THEN
    RETURN FALSE;
  END IF;

  -- Validate format with improved regex (2025 standards)
  -- Local part: starts with valid chars, dots only between groups of valid chars
  -- Domain: alphanumeric labels separated by dots, ending with 2+ char TLD
  IF trimmed_email ~* '^[A-Za-z0-9_%+-]+(\.[A-Za-z0-9_%+-]+)*@[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$' THEN
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
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
  updated_count INTEGER;
  window_start TIMESTAMPTZ;
BEGIN
  -- Calculate aligned fixed window start (bucketed by window size)
  window_start := to_timestamp(
    floor(extract(epoch from now()) / window_seconds_param) * window_seconds_param
  );

  -- Atomic upsert: insert new row, or update if exists and below limit
  INSERT INTO rate_limit_log (identifier, endpoint, request_count, window_start)
  VALUES (identifier_param, endpoint_param, 1, window_start)
  ON CONFLICT (identifier, endpoint, window_start)
  DO UPDATE SET request_count = rate_limit_log.request_count + 1
    WHERE rate_limit_log.request_count < max_requests_param
  RETURNING request_count INTO updated_count;

  -- Return true only if the request was successfully logged (allowed)
  -- If updated_count is NULL, the rate limit was reached and no update occurred
  RETURN updated_count IS NOT NULL;
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
  WHERE window_start < NOW() - (days * INTERVAL '1 day');
END;
$$;


-- =============================================
-- GRANT PERMISSIONS
-- =============================================
-- Allow only authorized roles to call these functions
-- TODO: Ensure authorization logic (or Row Level Security) restricts stock changes by user ownership!
GRANT EXECUTE ON FUNCTION decrement_product_stock TO authenticated;
GRANT EXECUTE ON FUNCTION decrement_variant_stock TO authenticated;
GRANT EXECUTE ON FUNCTION is_valid_email TO authenticated, anon;
GRANT EXECUTE ON FUNCTION check_rate_limit TO authenticated, anon;
GRANT EXECUTE ON FUNCTION cleanup_rate_limit_log TO authenticated;
