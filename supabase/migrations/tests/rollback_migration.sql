-- =============================================
-- ROLLBACK SCRIPT FOR 2025 BEST PRACTICES MIGRATION
-- Use this ONLY if you need to revert the migration
-- =============================================
-- WARNING: This will restore the old functions with their issues
-- Only use in emergency situations
-- =============================================

BEGIN;

\echo '========================================='
\echo 'ROLLING BACK MIGRATION'
\echo 'This will restore previous function definitions'
\echo '========================================='

-- =============================================
-- RESTORE OLD FUNCTIONS (with their issues)
-- =============================================

-- Restore check_rate_limit (old version without validation)
DROP FUNCTION IF EXISTS check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) CASCADE;
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

  SELECT COALESCE(SUM(request_count), 0) INTO current_count
  FROM rate_limit_log
  WHERE identifier = identifier_param
    AND endpoint = endpoint_param
    AND window_start > window_start_time;

  IF current_count >= max_requests THEN
    RETURN FALSE;
  END IF;

  INSERT INTO rate_limit_log (identifier, endpoint, request_count, window_start)
  VALUES (identifier_param, endpoint_param, 1, NOW())
  ON CONFLICT DO NOTHING;

  RETURN TRUE;
END;
$$;

-- Restore cleanup_rate_limit_logs
DROP FUNCTION IF EXISTS cleanup_rate_limit_logs() CASCADE;
CREATE OR REPLACE FUNCTION cleanup_rate_limit_logs()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM rate_limit_log
  WHERE created_at < NOW() - INTERVAL '1 hour';
END;
$$;

-- Restore decrement_product_stock
DROP FUNCTION IF EXISTS decrement_product_stock(UUID, INTEGER) CASCADE;
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
  SELECT stock_quantity INTO current_stock
  FROM products
  WHERE id = product_id_param
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0, 'Product not found';
    RETURN;
  END IF;

  IF current_stock < quantity_param THEN
    RETURN QUERY SELECT FALSE, current_stock, 'Insufficient stock';
    RETURN;
  END IF;

  UPDATE products
  SET stock_quantity = stock_quantity - quantity_param,
      updated_at = NOW()
  WHERE id = product_id_param
  RETURNING stock_quantity INTO updated_stock;

  RETURN QUERY SELECT TRUE, updated_stock, 'Stock updated successfully';
END;
$$;

-- Restore decrement_variant_stock
DROP FUNCTION IF EXISTS decrement_variant_stock(UUID, INTEGER) CASCADE;
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

-- Restore utility functions
DROP FUNCTION IF EXISTS sanitize_text_input(TEXT) CASCADE;
CREATE OR REPLACE FUNCTION sanitize_text_input(input_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  input_text := REPLACE(input_text, CHR(0), '');
  input_text := TRIM(input_text);
  IF LENGTH(input_text) > 10000 THEN
    input_text := SUBSTRING(input_text, 1, 10000);
  END IF;
  RETURN input_text;
END;
$$;

DROP FUNCTION IF EXISTS is_valid_email(TEXT) CASCADE;
CREATE OR REPLACE FUNCTION is_valid_email(email_text TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN email_text ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
END;
$$;

-- Restore order functions
DROP FUNCTION IF EXISTS generate_order_number_for_merchant(UUID) CASCADE;
CREATE OR REPLACE FUNCTION generate_order_number_for_merchant(merchant_uuid UUID)
RETURNS TEXT AS $$
DECLARE
    next_num INTEGER;
    order_num TEXT;
BEGIN
    INSERT INTO merchant_order_counters (merchant_id, last_order_number)
    VALUES (merchant_uuid, 1)
    ON CONFLICT (merchant_id)
    DO UPDATE SET last_order_number = merchant_order_counters.last_order_number + 1
    RETURNING last_order_number INTO next_num;

    order_num := '#' || LPAD(next_num::TEXT, 5, '0');
    RETURN order_num;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

DROP FUNCTION IF EXISTS set_order_number() CASCADE;
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := generate_order_number_for_merchant(NEW.merchant_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Restore customer functions
DROP FUNCTION IF EXISTS update_customer_full_name() CASCADE;
CREATE OR REPLACE FUNCTION update_customer_full_name()
RETURNS TRIGGER AS $$
BEGIN
  NEW.full_name := TRIM(CONCAT(COALESCE(NEW.first_name, ''), ' ', COALESCE(NEW.last_name, '')));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Restore domain functions
DROP FUNCTION IF EXISTS generate_merchant_slug() CASCADE;
CREATE OR REPLACE FUNCTION generate_merchant_slug()
RETURNS TRIGGER AS $$
BEGIN
  NEW.slug := lower(regexp_replace(NEW.business_name, E'[^\\w]+', '-', 'g'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS set_primary_domain(UUID, UUID) CASCADE;
CREATE OR REPLACE FUNCTION set_primary_domain(merchant_id_param UUID, domain_id_param UUID)
RETURNS void AS $$
BEGIN
    UPDATE domains
    SET is_primary = FALSE
    WHERE merchant_id = merchant_id_param AND is_primary = TRUE;

    UPDATE domains
    SET is_primary = TRUE
    WHERE id = domain_id_param AND merchant_id = merchant_id_param;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS ensure_single_primary_domain() CASCADE;
CREATE OR REPLACE FUNCTION ensure_single_primary_domain()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_primary THEN
        PERFORM set_primary_domain(NEW.merchant_id, NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- RESTORE OLD GRANTS (including anon)
-- =============================================

GRANT EXECUTE ON FUNCTION decrement_product_stock TO authenticated, anon;
GRANT EXECUTE ON FUNCTION decrement_variant_stock TO authenticated, anon;
GRANT EXECUTE ON FUNCTION sanitize_text_input TO authenticated, anon;
GRANT EXECUTE ON FUNCTION is_valid_email TO authenticated, anon;
GRANT EXECUTE ON FUNCTION check_rate_limit TO authenticated, anon;

-- =============================================
-- RESTORE TRIGGERS
-- =============================================

DROP TRIGGER IF EXISTS trigger_set_order_number ON orders;
CREATE TRIGGER trigger_set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL)
  EXECUTE FUNCTION set_order_number();

DROP TRIGGER IF EXISTS trigger_update_customer_full_name ON customers;
CREATE TRIGGER trigger_update_customer_full_name
  BEFORE INSERT OR UPDATE OF first_name, last_name ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_full_name();

DROP TRIGGER IF EXISTS set_merchant_slug ON merchants;
CREATE TRIGGER set_merchant_slug
  BEFORE INSERT OR UPDATE ON merchants
  FOR EACH ROW
  WHEN (NEW.business_name IS NOT NULL)
  EXECUTE FUNCTION generate_merchant_slug();

DROP TRIGGER IF EXISTS on_domain_primary_change ON domains;
CREATE TRIGGER on_domain_primary_change
  AFTER INSERT OR UPDATE ON domains
  FOR EACH ROW
  WHEN (NEW.is_primary = TRUE)
  EXECUTE FUNCTION ensure_single_primary_domain();

\echo '\n========================================='
\echo 'ROLLBACK COMPLETE'
\echo 'Old functions and grants restored'
\echo 'WARNING: Security issues are back!'
\echo '========================================='

-- Don't commit automatically - let user review
ROLLBACK;

\echo '\nTo apply this rollback, change ROLLBACK to COMMIT above'
