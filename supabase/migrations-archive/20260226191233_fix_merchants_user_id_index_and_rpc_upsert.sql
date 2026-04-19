-- Migration: Add missing merchants.user_id index + fix upsert_customer_on_auth race condition

-- ============================================================
-- 1. Add missing index on merchants.user_id
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_merchants_user_id
  ON merchants (user_id);

-- ============================================================
-- 2. Add unique partial index on customers(merchant_id, email)
--    Required for ON CONFLICT in the atomic upsert.
--    Partial: only WHERE email IS NOT NULL (allow multiple NULL emails).
-- ============================================================

-- First deduplicate: if any (merchant_id, email) pairs have duplicates,
-- keep the one with a user_id set (or most recently updated).
-- This is a data cleanup step that makes the UNIQUE index safe to create.
DELETE FROM customers c
WHERE c.email IS NOT NULL
  AND c.id NOT IN (
    SELECT DISTINCT ON (c2.merchant_id, c2.email) c2.id
    FROM customers c2
    WHERE c2.email IS NOT NULL
    ORDER BY c2.merchant_id, c2.email,
             -- Prefer rows with user_id linked, then most recent
             (c2.user_id IS NOT NULL) DESC,
             c2.updated_at DESC NULLS LAST,
             c2.created_at DESC NULLS LAST
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_merchant_email
  ON customers (merchant_id, email)
  WHERE email IS NOT NULL;

-- ============================================================
-- 3. Replace upsert_customer_on_auth with atomic ON CONFLICT upsert
--    Eliminates the SELECT-then-INSERT race condition.
-- ============================================================
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
  -- Atomic upsert: INSERT or UPDATE in a single statement.
  -- ON CONFLICT on (merchant_id, email) handles the race condition
  -- where two concurrent calls try to create the same customer.
  INSERT INTO customers (merchant_id, user_id, email, full_name, phone, last_login_at)
  VALUES (
    p_merchant_id,
    p_user_id,
    p_email,
    COALESCE(p_full_name, split_part(p_email, '@', 1)),
    p_phone,
    NOW()
  )
  ON CONFLICT (merchant_id, email) WHERE email IS NOT NULL
  DO UPDATE SET
    user_id       = COALESCE(customers.user_id, EXCLUDED.user_id),
    full_name     = COALESCE(EXCLUDED.full_name, customers.full_name),
    phone         = COALESCE(EXCLUDED.phone, customers.phone),
    last_login_at = NOW(),
    updated_at    = NOW()
  RETURNING id INTO v_customer_id;

  RETURN v_customer_id;
END;
$$;;
