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
-- TEXT SANITIZATION FUNCTION (UNSAFE - DO NOT USE FOR SECURITY)
-- =============================================
-- ⚠️ CRITICAL SECURITY WARNING ⚠️
-- !!! THIS FUNCTION PROVIDES NO ACTUAL SECURITY !!!
--
-- This function is ONLY for basic display text formatting.
-- DO NOT USE THIS FUNCTION TO PREVENT XSS OR ANY SECURITY ATTACKS.
--
-- Why this is unsafe:
--   1. Regex-based HTML sanitization is fundamentally flawed
--   2. Easily bypassed with: malformed tags, encoded characters, nested tags,
--      Unicode variants, null bytes, case variations, etc.
--   3. Cannot protect against DOM-based XSS, attribute injection, or CSS injection
--   4. Creates a FALSE SENSE OF SECURITY that may lead to vulnerabilities
--
-- Proper security measures:
--   - Use parameterized queries for database operations (prevents SQL injection)
--   - Use Content Security Policy (CSP) headers
--   - Use client-side sanitization with DOMPurify or similar vetted libraries
--   - Use framework-provided auto-escaping (React, Vue, Angular, etc.)
--   - Store raw user input and sanitize at display time in the client
--
-- Consider removing this function entirely to avoid misuse.
-- If you must use it, understand it provides cosmetic cleanup only, NOT security.
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION sanitize_text_input(text_input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
  DECLARE
    cleaned TEXT;
  BEGIN
    -- These regex patterns provide basic text cleanup only
    -- They DO NOT provide security against malicious input
    cleaned := regexp_replace(text_input, E'<[^>\\n]+>', '', 'g');
    cleaned := regexp_replace(cleaned, E'<.*?>', '', 'gn');
    cleaned := regexp_replace(cleaned, E'(?i)javascript:', '', 'g');
    cleaned := regexp_replace(cleaned, E'(?i)data:', '', 'g');
    cleaned := regexp_replace(cleaned, E'(?i)on\\w+\\s*=\\s*(?:"[^"]*"|\'[^\']*\'|[^\\s>]+)', '', 'g');
    RETURN btrim(cleaned);
  END;
$$;

-- Revoke from all roles to prevent misuse
-- DO NOT grant permissions unless you fully understand this provides NO security
REVOKE EXECUTE ON FUNCTION sanitize_text_input(text) FROM PUBLIC;


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

  -- Log this request and increment count on conflict
  INSERT INTO rate_limit_log (identifier, endpoint, request_count, window_start)
  VALUES (identifier_param, endpoint_param, 1, window_start)
  ON CONFLICT (identifier, endpoint, window_start) DO UPDATE
    SET request_count = rate_limit_log.request_count + 1;

  RETURN current_count < max_requests_param;
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
-- Allow only authorized roles to call these functions
-- TODO: Ensure authorization logic (or Row Level Security) restricts stock changes by user ownership!
GRANT EXECUTE ON FUNCTION decrement_product_stock TO authenticated;
GRANT EXECUTE ON FUNCTION decrement_variant_stock TO authenticated;
-- sanitize_text_input: NO permissions granted due to security concerns (see function warnings)
--                      Explicitly grant only if you understand it provides NO actual security
GRANT EXECUTE ON FUNCTION is_valid_email TO authenticated, anon;
GRANT EXECUTE ON FUNCTION check_rate_limit TO authenticated, anon;
GRANT EXECUTE ON FUNCTION cleanup_rate_limit_log TO authenticated;
