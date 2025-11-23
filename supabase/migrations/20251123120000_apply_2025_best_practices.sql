-- =============================================
-- MIGRATION: Apply 2025 SQL Best Practices
-- Date: 2025-11-23
-- Purpose: Fix all migration anti-patterns and security issues
--
-- Changes Applied:
-- 1. Remove CREATE OR REPLACE FUNCTION (use DROP + CREATE)
-- 2. Remove IF NOT EXISTS patterns (proper idempotent migrations)
-- 3. Add search_path to all SECURITY DEFINER functions
-- 4. Revoke inappropriate anon grants
-- 5. Add missing updated_at triggers
-- 6. Optimize indexes with composite keys
-- 7. Apply security hardening
-- =============================================

-- =============================================
-- SECTION 1: FIX RATE_LIMIT_LOG TABLE SCHEMA
-- =============================================

-- Drop existing table and recreate with proper schema
DROP TABLE IF EXISTS rate_limit_log CASCADE;

CREATE TABLE rate_limit_log (
  identifier TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (identifier, endpoint, window_start)
);

-- Composite index for optimal rate limit queries
CREATE INDEX idx_rate_limit_log_identifier_endpoint_window_start
  ON rate_limit_log(identifier, endpoint, window_start);

-- Index for cleanup queries
CREATE INDEX idx_rate_limit_log_created_at
  ON rate_limit_log(created_at);

-- Enable RLS (table should only be accessed via security-definer functions)
ALTER TABLE rate_limit_log ENABLE ROW LEVEL SECURITY;

-- Deny all direct access - force use of security-definer functions
DROP POLICY IF EXISTS "Deny all access to rate_limit_log" ON rate_limit_log;
CREATE POLICY "Deny all access to rate_limit_log"
  ON rate_limit_log
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- =============================================
-- SECTION 2: UPDATED_AT TRIGGER FOR RATE_LIMIT_LOG
-- =============================================

-- Trigger function to automatically update updated_at
DROP FUNCTION IF EXISTS trg_set_updated_at_rate_limit_log() CASCADE;
CREATE FUNCTION trg_set_updated_at_rate_limit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_update_rate_limit_log_updated_at ON rate_limit_log;
CREATE TRIGGER trg_update_rate_limit_log_updated_at
  BEFORE UPDATE ON rate_limit_log
  FOR EACH ROW
  EXECUTE FUNCTION trg_set_updated_at_rate_limit_log();

-- =============================================
-- SECTION 3: RECREATE ALL FUNCTIONS WITH PROPER PATTERNS
-- =============================================

-- 3.1 Rate Limiting Functions
-- =============================================

DROP FUNCTION IF EXISTS check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) CASCADE;
CREATE FUNCTION check_rate_limit(
  identifier_param TEXT,
  endpoint_param TEXT,
  max_requests INTEGER DEFAULT 100,
  window_minutes INTEGER DEFAULT 1
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER  -- Changed from implicit to explicit
SET search_path = pg_catalog, public
AS $$
DECLARE
  current_count INTEGER;
  window_start_time TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Input validation
  IF identifier_param IS NULL OR endpoint_param IS NULL THEN
    RAISE EXCEPTION 'identifier and endpoint cannot be null';
  END IF;

  IF max_requests <= 0 OR window_minutes <= 0 THEN
    RAISE EXCEPTION 'max_requests and window_minutes must be positive';
  END IF;

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

  -- Log this request (use INSERT or UPDATE for idempotency)
  INSERT INTO rate_limit_log (identifier, endpoint, request_count, window_start)
  VALUES (identifier_param, endpoint_param, 1, NOW())
  ON CONFLICT (identifier, endpoint, window_start)
  DO UPDATE SET
    request_count = rate_limit_log.request_count + 1,
    updated_at = NOW();

  RETURN TRUE;
END;
$$;

DROP FUNCTION IF EXISTS cleanup_rate_limit_logs() CASCADE;
CREATE FUNCTION cleanup_rate_limit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER  -- Needs elevated privileges to delete
SET search_path = pg_catalog, public
AS $$
BEGIN
  DELETE FROM rate_limit_log
  WHERE created_at < NOW() - INTERVAL '1 hour';
END;
$$;

-- 3.2 Stock Management Functions (SECURITY DEFINER - need elevated privileges)
-- =============================================

DROP FUNCTION IF EXISTS decrement_product_stock(UUID, INTEGER) CASCADE;
CREATE FUNCTION decrement_product_stock(
  product_id_param UUID,
  quantity_param INTEGER
)
RETURNS TABLE(success BOOLEAN, new_stock INTEGER, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  current_stock INTEGER;
  updated_stock INTEGER;
BEGIN
  -- Input validation
  IF product_id_param IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 'Product ID cannot be null';
    RETURN;
  END IF;

  IF quantity_param <= 0 THEN
    RETURN QUERY SELECT FALSE, 0, 'Quantity must be positive';
    RETURN;
  END IF;

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

DROP FUNCTION IF EXISTS decrement_variant_stock(UUID, INTEGER) CASCADE;
CREATE FUNCTION decrement_variant_stock(
  variant_id_param UUID,
  quantity_param INTEGER
)
RETURNS TABLE(success BOOLEAN, new_stock INTEGER, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  current_stock INTEGER;
  updated_stock INTEGER;
BEGIN
  -- Input validation
  IF variant_id_param IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 'Variant ID cannot be null';
    RETURN;
  END IF;

  IF quantity_param <= 0 THEN
    RETURN QUERY SELECT FALSE, 0, 'Quantity must be positive';
    RETURN;
  END IF;

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
  SET stock_quantity = stock_quantity - quantity_param,
      updated_at = NOW()
  WHERE id = variant_id_param
  RETURNING stock_quantity INTO updated_stock;

  RETURN QUERY SELECT TRUE, updated_stock, 'Stock updated successfully';
END;
$$;

-- 3.3 Utility Functions (IMMUTABLE for safety)
-- =============================================

DROP FUNCTION IF EXISTS sanitize_text_input(TEXT) CASCADE;
CREATE FUNCTION sanitize_text_input(input_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF input_text IS NULL THEN
    RETURN NULL;
  END IF;

  -- Remove null bytes
  input_text := REPLACE(input_text, CHR(0), '');

  -- Trim whitespace
  input_text := TRIM(input_text);

  -- Limit length to prevent DoS (configurable based on use case)
  IF LENGTH(input_text) > 10000 THEN
    input_text := SUBSTRING(input_text, 1, 10000);
  END IF;

  RETURN input_text;
END;
$$;

DROP FUNCTION IF EXISTS is_valid_email(TEXT) CASCADE;
CREATE FUNCTION is_valid_email(email_text TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF email_text IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Basic email validation (RFC 5322 simplified)
  -- More comprehensive validation should be done in application layer
  RETURN email_text ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
END;
$$;

-- 3.4 Order Number Generation (from 20251104000001)
-- =============================================

DROP FUNCTION IF EXISTS generate_order_number_for_merchant(UUID) CASCADE;
CREATE FUNCTION generate_order_number_for_merchant(merchant_uuid UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    next_num INTEGER;
    order_num TEXT;
BEGIN
    IF merchant_uuid IS NULL THEN
        RAISE EXCEPTION 'merchant_uuid cannot be null';
    END IF;

    -- Initialize counter for new merchants or increment existing one atomically
    INSERT INTO merchant_order_counters (merchant_id, last_order_number)
    VALUES (merchant_uuid, 1)
    ON CONFLICT (merchant_id)
    DO UPDATE SET last_order_number = merchant_order_counters.last_order_number + 1
    RETURNING last_order_number INTO next_num;

    -- Format the order number (e.g., #00001)
    order_num := '#' || LPAD(next_num::TEXT, 5, '0');
    RETURN order_num;
END;
$$;

DROP FUNCTION IF EXISTS set_order_number() CASCADE;
CREATE FUNCTION set_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := generate_order_number_for_merchant(NEW.merchant_id);
  END IF;
  RETURN NEW;
END;
$$;

-- 3.5 Customer Functions (from 20251122000002_fix_customers_constraints)
-- =============================================

DROP FUNCTION IF EXISTS update_customer_full_name() CASCADE;
CREATE FUNCTION update_customer_full_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.full_name := TRIM(CONCAT(COALESCE(NEW.first_name, ''), ' ', COALESCE(NEW.last_name, '')));
  RETURN NEW;
END;
$$;

-- 3.6 Domain Functions (from 20251122000002_create_domains_table)
-- =============================================

DROP FUNCTION IF EXISTS generate_merchant_slug() CASCADE;
CREATE FUNCTION generate_merchant_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.slug := lower(regexp_replace(NEW.business_name, E'[^\\w]+', '-', 'g'));
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS set_primary_domain(UUID, UUID) CASCADE;
CREATE FUNCTION set_primary_domain(merchant_id_param UUID, domain_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF merchant_id_param IS NULL OR domain_id_param IS NULL THEN
        RAISE EXCEPTION 'merchant_id and domain_id cannot be null';
    END IF;

    -- First, unset any other primary domain for this merchant
    UPDATE domains
    SET is_primary = FALSE
    WHERE merchant_id = merchant_id_param AND is_primary = TRUE;

    -- Set the new primary domain, ONLY if it belongs to the given merchant
    UPDATE domains
    SET is_primary = TRUE
    WHERE id = domain_id_param AND merchant_id = merchant_id_param;
END;
$$;

DROP FUNCTION IF EXISTS ensure_single_primary_domain() CASCADE;
CREATE FUNCTION ensure_single_primary_domain()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF NEW.is_primary THEN
        PERFORM set_primary_domain(NEW.merchant_id, NEW.id);
    END IF;
    RETURN NEW;
END;
$$;

-- =============================================
-- SECTION 4: GRANT APPROPRIATE PERMISSIONS
-- =============================================

-- Utility functions - safe for both authenticated and anon
GRANT EXECUTE ON FUNCTION sanitize_text_input TO authenticated, anon;
GRANT EXECUTE ON FUNCTION is_valid_email TO authenticated, anon;

-- Rate limiting - authenticated only (anon users can be rate limited by IP at application layer)
GRANT EXECUTE ON FUNCTION check_rate_limit TO authenticated;
REVOKE EXECUTE ON FUNCTION check_rate_limit FROM anon;

-- Cleanup function - restricted to service role only
REVOKE EXECUTE ON FUNCTION cleanup_rate_limit_logs FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_rate_limit_logs TO service_role;

-- Stock management - authenticated users only (CRITICAL: no anon access)
GRANT EXECUTE ON FUNCTION decrement_product_stock TO authenticated;
GRANT EXECUTE ON FUNCTION decrement_variant_stock TO authenticated;
REVOKE EXECUTE ON FUNCTION decrement_product_stock FROM anon;
REVOKE EXECUTE ON FUNCTION decrement_variant_stock FROM anon;

-- Order generation - authenticated only
GRANT EXECUTE ON FUNCTION generate_order_number_for_merchant TO authenticated;
REVOKE EXECUTE ON FUNCTION generate_order_number_for_merchant FROM anon;

-- Domain management - authenticated only
GRANT EXECUTE ON FUNCTION set_primary_domain TO authenticated;
REVOKE EXECUTE ON FUNCTION set_primary_domain FROM anon;

-- =============================================
-- SECTION 5: ADD COMMENTS FOR DOCUMENTATION
-- =============================================

COMMENT ON TABLE rate_limit_log IS 'Internal rate limiting table. RLS enabled - access only via security-definer functions. Auto-cleanup after 1 hour.';
COMMENT ON FUNCTION check_rate_limit IS 'Rate limit checker with configurable windows. Returns FALSE if limit exceeded.';
COMMENT ON FUNCTION cleanup_rate_limit_logs IS 'Removes rate limit logs older than 1 hour. Run via cron/pg_cron.';
COMMENT ON FUNCTION decrement_product_stock IS 'Atomically decrements product stock with row-level locking. SECURITY DEFINER - authenticated users only.';
COMMENT ON FUNCTION decrement_variant_stock IS 'Atomically decrements variant stock with row-level locking. SECURITY DEFINER - authenticated users only.';
COMMENT ON FUNCTION sanitize_text_input IS 'Sanitizes text input: removes null bytes, trims whitespace, limits length. Safe for anon use.';
COMMENT ON FUNCTION is_valid_email IS 'Basic email format validation using regex. Application layer should do comprehensive validation.';
COMMENT ON FUNCTION generate_order_number_for_merchant IS 'Generates sequential order numbers per merchant. SECURITY DEFINER - prevents race conditions.';
COMMENT ON FUNCTION set_primary_domain IS 'Sets a domain as primary for a merchant. Ensures only one primary domain per merchant.';
COMMENT ON FUNCTION ensure_single_primary_domain IS 'Trigger function to maintain single primary domain constraint.';

-- =============================================
-- SECTION 6: RECREATE TRIGGERS
-- =============================================
-- Note: Triggers were dropped via CASCADE when functions were dropped
-- Now recreate them with the new functions

-- Rate limit updated_at trigger (already created in Section 2)

-- Order number generation trigger
DROP TRIGGER IF EXISTS trigger_set_order_number ON orders;
CREATE TRIGGER trigger_set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL)
  EXECUTE FUNCTION set_order_number();

-- Customer full name trigger
DROP TRIGGER IF EXISTS trigger_update_customer_full_name ON customers;
CREATE TRIGGER trigger_update_customer_full_name
  BEFORE INSERT OR UPDATE OF first_name, last_name ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_full_name();

-- Merchant slug generation trigger
DROP TRIGGER IF EXISTS set_merchant_slug ON merchants;
CREATE TRIGGER set_merchant_slug
  BEFORE INSERT OR UPDATE ON merchants
  FOR EACH ROW
  WHEN (NEW.business_name IS NOT NULL)
  EXECUTE FUNCTION generate_merchant_slug();

-- Domain primary constraint trigger
DROP TRIGGER IF EXISTS on_domain_primary_change ON domains;
CREATE TRIGGER on_domain_primary_change
  AFTER INSERT OR UPDATE ON domains
  FOR EACH ROW
  WHEN (NEW.is_primary = TRUE)
  EXECUTE FUNCTION ensure_single_primary_domain();

-- =============================================
-- SECTION 7: ADDITIONAL SECURITY HARDENING
-- =============================================

-- Ensure all SECURITY DEFINER functions have proper search_path
-- (Already set inline in function definitions above using SET search_path)

-- Double-check RLS is enabled on sensitive tables
ALTER TABLE rate_limit_log ENABLE ROW LEVEL SECURITY;

-- Add table comments for sensitive tables
COMMENT ON POLICY "Deny all access to rate_limit_log" ON rate_limit_log IS
  'Denies all direct access. Table should only be accessed via check_rate_limit() function.';

-- =============================================
-- END OF MIGRATION
-- =============================================
