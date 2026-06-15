-- Migration: Staff access policies for domains and discount codes
-- Created: 2026-02-21
-- Description: Align RLS with staff permission model used in dashboard actions/APIs.

-- -----------------------------------------------------------------------------
-- discount_codes: owner + staff (marketing permissions)
-- -----------------------------------------------------------------------------

ALTER TABLE IF EXISTS discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS discount_code_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants can manage their own discount codes" ON discount_codes;
DROP POLICY IF EXISTS "Staff can view discount codes" ON discount_codes;
DROP POLICY IF EXISTS "Staff can insert discount codes" ON discount_codes;
DROP POLICY IF EXISTS "Staff can update discount codes" ON discount_codes;
DROP POLICY IF EXISTS "Staff can delete discount codes" ON discount_codes;

CREATE POLICY "Staff can view discount codes" ON discount_codes
  FOR SELECT
  USING (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
    OR check_staff_permission(auth.uid(), merchant_id, 'marketing', 'view')
    OR check_staff_permission(auth.uid(), merchant_id, 'marketing', 'edit')
  );

CREATE POLICY "Staff can insert discount codes" ON discount_codes
  FOR INSERT
  WITH CHECK (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
    OR check_staff_permission(auth.uid(), merchant_id, 'marketing', 'create')
    OR check_staff_permission(auth.uid(), merchant_id, 'marketing', 'edit')
  );

CREATE POLICY "Staff can update discount codes" ON discount_codes
  FOR UPDATE
  USING (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
    OR check_staff_permission(auth.uid(), merchant_id, 'marketing', 'edit')
  )
  WITH CHECK (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
    OR check_staff_permission(auth.uid(), merchant_id, 'marketing', 'edit')
  );

CREATE POLICY "Staff can delete discount codes" ON discount_codes
  FOR DELETE
  USING (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
    OR check_staff_permission(auth.uid(), merchant_id, 'marketing', 'delete')
    OR check_staff_permission(auth.uid(), merchant_id, 'marketing', 'edit')
  );

DROP POLICY IF EXISTS "Merchants can view their discount code usage" ON discount_code_usage;
DROP POLICY IF EXISTS "Staff can view discount code usage" ON discount_code_usage;

CREATE POLICY "Staff can view discount code usage" ON discount_code_usage
  FOR SELECT
  USING (
    discount_code_id IN (
      SELECT dc.id
      FROM discount_codes dc
      WHERE dc.merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
        OR check_staff_permission(auth.uid(), dc.merchant_id, 'marketing', 'view')
        OR check_staff_permission(auth.uid(), dc.merchant_id, 'marketing', 'edit')
    )
  );

-- -----------------------------------------------------------------------------
-- domains: owner + staff (settings permissions)
-- -----------------------------------------------------------------------------

ALTER TABLE IF EXISTS domains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants can view their own domains" ON domains;
DROP POLICY IF EXISTS "Merchants can create domains" ON domains;
DROP POLICY IF EXISTS "Merchants can update their own domains" ON domains;
DROP POLICY IF EXISTS "Merchants can delete their own domains" ON domains;
DROP POLICY IF EXISTS "Merchant staff can view own domains" ON domains;
DROP POLICY IF EXISTS "Merchant staff can create domains" ON domains;
DROP POLICY IF EXISTS "Merchant staff can update domains" ON domains;
DROP POLICY IF EXISTS "Merchant staff can delete domains" ON domains;

CREATE POLICY "Merchant staff can view own domains" ON domains
  FOR SELECT
  TO authenticated
  USING (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
    OR check_staff_permission(auth.uid(), merchant_id, 'settings', 'view')
    OR check_staff_permission(auth.uid(), merchant_id, 'settings', 'edit')
  );

CREATE POLICY "Merchant staff can create domains" ON domains
  FOR INSERT
  TO authenticated
  WITH CHECK (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
    OR check_staff_permission(auth.uid(), merchant_id, 'settings', 'edit')
  );

CREATE POLICY "Merchant staff can update domains" ON domains
  FOR UPDATE
  TO authenticated
  USING (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
    OR check_staff_permission(auth.uid(), merchant_id, 'settings', 'edit')
  )
  WITH CHECK (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
    OR check_staff_permission(auth.uid(), merchant_id, 'settings', 'edit')
  );

CREATE POLICY "Merchant staff can delete domains" ON domains
  FOR DELETE
  TO authenticated
  USING (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
    OR check_staff_permission(auth.uid(), merchant_id, 'settings', 'edit')
  );
