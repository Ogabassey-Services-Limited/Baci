-- =============================================
-- Migration: Tax Compliance Phase 1 - Peppol BIS Billing 3.0 & Nigeria FIRS Ready
-- Created: 2024-12-04
-- Description: Adds merchant tax settings and invoice structure for compliance with:
--   - Peppol BIS Billing 3.0 (55 mandatory fields)
--   - Nigeria FIRS e-invoicing requirements
--   - Nigeria Tax Act 2025 (effective Jan 1, 2026)
--
-- References:
--   - https://docs.peppol.eu/poacc/billing/3.0/
--   - https://blog.eezi.io/e-invoicing-in-nigeria-firs-b2b-and-b2c-mandate/
-- =============================================

-- ============================================
-- 1. MERCHANT TAX SETTINGS
-- ============================================

-- Add tax-related columns to merchants table
ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS tax_identification_number TEXT,
ADD COLUMN IF NOT EXISTS cac_rc_number TEXT,
ADD COLUMN IF NOT EXISTS vat_registration_status TEXT DEFAULT 'not_registered',
ADD COLUMN IF NOT EXISTS vat_rate DECIMAL(5, 2) DEFAULT 7.5,
ADD COLUMN IF NOT EXISTS tax_exempt BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS legal_entity_name TEXT,
ADD COLUMN IF NOT EXISTS registered_address JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS endpoint_id TEXT,
ADD COLUMN IF NOT EXISTS endpoint_scheme_id TEXT DEFAULT '0195';

-- Add constraints for TIN format (10 digits for Nigeria)
ALTER TABLE merchants
ADD CONSTRAINT merchants_tin_format
CHECK (tax_identification_number IS NULL OR tax_identification_number ~ '^[0-9]{10}$');

-- Add constraints for RC number format (RC followed by digits)
ALTER TABLE merchants
ADD CONSTRAINT merchants_rc_format
CHECK (cac_rc_number IS NULL OR cac_rc_number ~ '^(RC|BN|IT|LP)?[0-9]+$');

-- Add constraint for VAT registration status
ALTER TABLE merchants
ADD CONSTRAINT merchants_vat_status_valid
CHECK (vat_registration_status IN ('not_registered', 'registered', 'exempt', 'pending'));

-- Comment on columns for documentation
COMMENT ON COLUMN merchants.tax_identification_number IS 'Nigerian TIN (10 digits) - required for VAT-registered businesses';
COMMENT ON COLUMN merchants.cac_rc_number IS 'CAC Registration Number (RC, BN, IT, or LP prefix)';
COMMENT ON COLUMN merchants.vat_registration_status IS 'VAT status: not_registered, registered, exempt, pending';
COMMENT ON COLUMN merchants.vat_rate IS 'VAT rate percentage (default 7.5% for Nigeria)';
COMMENT ON COLUMN merchants.tax_exempt IS 'Whether merchant qualifies for small business exemption (turnover <= N100M)';
COMMENT ON COLUMN merchants.legal_entity_name IS 'Full legal/registered name of the business (required for Peppol)';
COMMENT ON COLUMN merchants.registered_address IS 'Full registered business address with country code (ISO 3166-1)';
COMMENT ON COLUMN merchants.endpoint_id IS 'Electronic address identifier for Peppol e-invoicing';
COMMENT ON COLUMN merchants.endpoint_scheme_id IS 'Endpoint scheme (0195 = Nigerian TIN, 9959 = Nigerian National ID)';

-- ============================================
-- 2. INVOICE LINE ENHANCEMENTS
-- ============================================

-- Add Peppol-required fields to order_items
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS line_id INTEGER,
ADD COLUMN IF NOT EXISTS unit_code TEXT DEFAULT 'EA',
ADD COLUMN IF NOT EXISTS line_extension_amount DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS vat_category_code TEXT DEFAULT 'S',
ADD COLUMN IF NOT EXISTS vat_rate DECIMAL(5, 2) DEFAULT 7.5,
ADD COLUMN IF NOT EXISTS vat_amount DECIMAL(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS item_description TEXT,
ADD COLUMN IF NOT EXISTS sellers_item_id TEXT;

-- Add constraint for VAT category codes (Peppol standard)
ALTER TABLE order_items
ADD CONSTRAINT order_items_vat_category_valid
CHECK (vat_category_code IN (
  'S',  -- Standard rate
  'Z',  -- Zero rated
  'E',  -- Exempt
  'AE', -- Reverse charge
  'K',  -- Intra-community supply
  'G',  -- Export outside EU
  'O',  -- Outside scope
  'L',  -- Canary Islands
  'M'   -- Ceuta and Melilla
));

-- Add constraint for common UN/ECE Rec 20 unit codes
ALTER TABLE order_items
ADD CONSTRAINT order_items_unit_code_valid
CHECK (unit_code IN (
  'EA',  -- Each/unit
  'KGM', -- Kilogram
  'GRM', -- Gram
  'MTR', -- Metre
  'LTR', -- Litre
  'MTK', -- Square metre
  'MTQ', -- Cubic metre
  'PCE', -- Piece
  'SET', -- Set
  'PR',  -- Pair
  'PK',  -- Pack
  'BX',  -- Box
  'CT',  -- Carton
  'DZN', -- Dozen
  'HUR', -- Hour
  'DAY', -- Day
  'MON', -- Month
  'ANN'  -- Year
));

COMMENT ON COLUMN order_items.line_id IS 'Sequential line identifier within the invoice (BT-126)';
COMMENT ON COLUMN order_items.unit_code IS 'UN/ECE Rec 20 unit code (BT-130)';
COMMENT ON COLUMN order_items.line_extension_amount IS 'Line net amount = quantity * price (BT-131)';
COMMENT ON COLUMN order_items.vat_category_code IS 'VAT category code per Peppol (BT-151)';
COMMENT ON COLUMN order_items.vat_rate IS 'VAT percentage rate for this line (BT-152)';
COMMENT ON COLUMN order_items.vat_amount IS 'VAT amount for this line';
COMMENT ON COLUMN order_items.item_description IS 'Item description (BT-154)';
COMMENT ON COLUMN order_items.sellers_item_id IS 'Seller item identifier / SKU (BT-155)';

-- ============================================
-- 3. ORDER TAX BREAKDOWN
-- ============================================

-- Create table for VAT breakdown per category (required for Peppol)
CREATE TABLE IF NOT EXISTS order_tax_subtotals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  vat_category_code TEXT NOT NULL DEFAULT 'S',
  vat_rate DECIMAL(5, 2) NOT NULL DEFAULT 7.5,
  taxable_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  exemption_reason TEXT,
  exemption_reason_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT order_tax_subtotals_category_valid
  CHECK (vat_category_code IN ('S', 'Z', 'E', 'AE', 'K', 'G', 'O', 'L', 'M'))
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_order_tax_subtotals_order_id
ON order_tax_subtotals(order_id);

-- RLS for order_tax_subtotals
ALTER TABLE order_tax_subtotals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_tax_subtotals_merchant_access"
ON order_tax_subtotals
FOR ALL
USING (
  order_id IN (
    SELECT o.id FROM orders o
    WHERE o.merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
  )
);

-- ============================================
-- 4. INVOICE METADATA
-- ============================================

-- Add invoice-specific fields to orders
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS invoice_type_code TEXT DEFAULT '380',
ADD COLUMN IF NOT EXISTS invoice_issue_date DATE,
ADD COLUMN IF NOT EXISTS tax_point_date DATE,
ADD COLUMN IF NOT EXISTS buyer_reference TEXT,
ADD COLUMN IF NOT EXISTS purchase_order_reference TEXT,
ADD COLUMN IF NOT EXISTS tax_exclusive_amount DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS tax_inclusive_amount DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS invoice_note TEXT,
ADD COLUMN IF NOT EXISTS payment_terms TEXT,
ADD COLUMN IF NOT EXISTS payment_due_date DATE,
ADD COLUMN IF NOT EXISTS invoice_pdf_url TEXT,
ADD COLUMN IF NOT EXISTS firs_irn TEXT,
ADD COLUMN IF NOT EXISTS firs_csid TEXT,
ADD COLUMN IF NOT EXISTS firs_submission_status TEXT DEFAULT 'not_submitted',
ADD COLUMN IF NOT EXISTS firs_submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS firs_qr_code TEXT;

-- Add constraint for invoice type codes (UNCL 1001)
ALTER TABLE orders
ADD CONSTRAINT orders_invoice_type_valid
CHECK (invoice_type_code IN (
  '380', -- Commercial invoice
  '381', -- Credit note
  '383', -- Debit note
  '384', -- Corrected invoice
  '386', -- Prepayment invoice
  '389', -- Self-billed invoice
  '751'  -- Invoice information for accounting purposes
));

-- Add constraint for FIRS submission status
ALTER TABLE orders
ADD CONSTRAINT orders_firs_status_valid
CHECK (firs_submission_status IN (
  'not_submitted',
  'pending',
  'submitted',
  'validated',
  'rejected',
  'exempt'
));

COMMENT ON COLUMN orders.invoice_type_code IS 'UNCL 1001 invoice type code (BT-3)';
COMMENT ON COLUMN orders.invoice_issue_date IS 'Invoice issue date (BT-2)';
COMMENT ON COLUMN orders.tax_point_date IS 'VAT accounting date (BT-7)';
COMMENT ON COLUMN orders.buyer_reference IS 'Buyer reference / PO number (BT-10)';
COMMENT ON COLUMN orders.purchase_order_reference IS 'Purchase order reference (BT-13)';
COMMENT ON COLUMN orders.tax_exclusive_amount IS 'Total excluding VAT (BT-109)';
COMMENT ON COLUMN orders.tax_inclusive_amount IS 'Total including VAT (BT-112)';
COMMENT ON COLUMN orders.invoice_note IS 'Invoice note / comments (BT-22)';
COMMENT ON COLUMN orders.payment_terms IS 'Payment terms description (BT-20)';
COMMENT ON COLUMN orders.payment_due_date IS 'Payment due date (BT-9)';
COMMENT ON COLUMN orders.invoice_pdf_url IS 'URL to generated PDF invoice';
COMMENT ON COLUMN orders.firs_irn IS 'FIRS Invoice Reference Number';
COMMENT ON COLUMN orders.firs_csid IS 'FIRS Cryptographic Stamp Identifier';
COMMENT ON COLUMN orders.firs_submission_status IS 'FIRS e-invoice submission status';
COMMENT ON COLUMN orders.firs_submitted_at IS 'When invoice was submitted to FIRS';
COMMENT ON COLUMN orders.firs_qr_code IS 'QR code data for FIRS verification';

-- ============================================
-- 5. PRODUCT TAX SETTINGS
-- ============================================

-- Add tax-related columns to products
ALTER TABLE products
ADD COLUMN IF NOT EXISTS vat_category_code TEXT DEFAULT 'S',
ADD COLUMN IF NOT EXISTS vat_rate DECIMAL(5, 2) DEFAULT 7.5,
ADD COLUMN IF NOT EXISTS tax_exempt BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS commodity_code TEXT,
ADD COLUMN IF NOT EXISTS unit_code TEXT DEFAULT 'EA';

-- Add constraint for VAT category
ALTER TABLE products
ADD CONSTRAINT products_vat_category_valid
CHECK (vat_category_code IN ('S', 'Z', 'E', 'AE', 'K', 'G', 'O', 'L', 'M'));

-- Add constraint for unit code
ALTER TABLE products
ADD CONSTRAINT products_unit_code_valid
CHECK (unit_code IN ('EA', 'KGM', 'GRM', 'MTR', 'LTR', 'MTK', 'MTQ', 'PCE', 'SET', 'PR', 'PK', 'BX', 'CT', 'DZN', 'HUR', 'DAY', 'MON', 'ANN'));

COMMENT ON COLUMN products.vat_category_code IS 'Default VAT category for this product';
COMMENT ON COLUMN products.vat_rate IS 'VAT rate for this product (default 7.5%)';
COMMENT ON COLUMN products.tax_exempt IS 'Whether this product is tax exempt';
COMMENT ON COLUMN products.commodity_code IS 'Commodity classification code (BT-158)';
COMMENT ON COLUMN products.unit_code IS 'Default unit of measure (UN/ECE Rec 20)';

-- ============================================
-- 6. FUNCTIONS FOR TAX CALCULATIONS
-- ============================================

-- Function to calculate VAT for an order
CREATE OR REPLACE FUNCTION calculate_order_vat(order_uuid UUID)
RETURNS TABLE (
  tax_exclusive_total DECIMAL(12, 2),
  tax_amount DECIMAL(12, 2),
  tax_inclusive_total DECIMAL(12, 2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  merchant_vat_status TEXT;
  merchant_vat_rate DECIMAL(5, 2);
BEGIN
  -- Get merchant VAT settings
  SELECT m.vat_registration_status, m.vat_rate
  INTO merchant_vat_status, merchant_vat_rate
  FROM orders o
  JOIN merchants m ON o.merchant_id = m.id
  WHERE o.id = order_uuid;

  -- If merchant is not VAT registered, return zero VAT
  IF merchant_vat_status != 'registered' THEN
    RETURN QUERY
    SELECT
      COALESCE(o.subtotal, 0)::DECIMAL(12, 2) AS tax_exclusive_total,
      0::DECIMAL(12, 2) AS tax_amount,
      COALESCE(o.total, 0)::DECIMAL(12, 2) AS tax_inclusive_total
    FROM orders o
    WHERE o.id = order_uuid;
    RETURN;
  END IF;

  -- Calculate VAT from line items
  RETURN QUERY
  SELECT
    COALESCE(SUM(oi.line_extension_amount), o.subtotal)::DECIMAL(12, 2) AS tax_exclusive_total,
    COALESCE(SUM(oi.vat_amount), ROUND(o.subtotal * merchant_vat_rate / 100, 2))::DECIMAL(12, 2) AS tax_amount,
    COALESCE(SUM(oi.line_extension_amount + oi.vat_amount), o.total)::DECIMAL(12, 2) AS tax_inclusive_total
  FROM orders o
  LEFT JOIN order_items oi ON oi.order_id = o.id
  WHERE o.id = order_uuid
  GROUP BY o.id, o.subtotal, o.total;
END;
$$;

-- Function to auto-populate line item tax fields
CREATE OR REPLACE FUNCTION populate_order_item_tax()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  product_vat_category TEXT;
  product_vat_rate DECIMAL(5, 2);
  product_unit TEXT;
  merchant_vat_status TEXT;
  next_line_id INTEGER;
BEGIN
  -- Get the next line ID for this order
  SELECT COALESCE(MAX(line_id), 0) + 1
  INTO next_line_id
  FROM order_items
  WHERE order_id = NEW.order_id;

  -- Set line ID if not provided
  IF NEW.line_id IS NULL THEN
    NEW.line_id := next_line_id;
  END IF;

  -- Get product tax settings if product_id is provided
  IF NEW.product_id IS NOT NULL THEN
    SELECT p.vat_category_code, p.vat_rate, p.unit_code, p.sku
    INTO product_vat_category, product_vat_rate, product_unit, NEW.sellers_item_id
    FROM products p
    WHERE p.id = NEW.product_id;

    IF product_vat_category IS NOT NULL THEN
      NEW.vat_category_code := product_vat_category;
    END IF;
    IF product_vat_rate IS NOT NULL THEN
      NEW.vat_rate := product_vat_rate;
    END IF;
    IF product_unit IS NOT NULL THEN
      NEW.unit_code := product_unit;
    END IF;
  END IF;

  -- Calculate line extension amount
  NEW.line_extension_amount := ROUND(NEW.quantity * NEW.price, 2);

  -- Get merchant VAT status
  SELECT m.vat_registration_status
  INTO merchant_vat_status
  FROM orders o
  JOIN merchants m ON o.merchant_id = m.id
  WHERE o.id = NEW.order_id;

  -- Calculate VAT amount if merchant is registered
  IF merchant_vat_status = 'registered' AND NEW.vat_category_code = 'S' THEN
    NEW.vat_amount := ROUND(NEW.line_extension_amount * NEW.vat_rate / 100, 2);
  ELSE
    NEW.vat_amount := 0;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for order items
DROP TRIGGER IF EXISTS trigger_populate_order_item_tax ON order_items;
CREATE TRIGGER trigger_populate_order_item_tax
  BEFORE INSERT ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION populate_order_item_tax();

-- Function to update order tax totals after items change
CREATE OR REPLACE FUNCTION update_order_tax_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  order_uuid UUID;
  new_tax_exclusive DECIMAL(12, 2);
  new_tax_amount DECIMAL(12, 2);
  merchant_vat_status TEXT;
BEGIN
  -- Determine which order to update
  IF TG_OP = 'DELETE' THEN
    order_uuid := OLD.order_id;
  ELSE
    order_uuid := NEW.order_id;
  END IF;

  -- Get merchant VAT status
  SELECT m.vat_registration_status
  INTO merchant_vat_status
  FROM orders o
  JOIN merchants m ON o.merchant_id = m.id
  WHERE o.id = order_uuid;

  -- Calculate totals from line items
  SELECT
    COALESCE(SUM(line_extension_amount), 0),
    COALESCE(SUM(vat_amount), 0)
  INTO new_tax_exclusive, new_tax_amount
  FROM order_items
  WHERE order_id = order_uuid;

  -- Update order with calculated tax amounts
  UPDATE orders
  SET
    tax_exclusive_amount = new_tax_exclusive,
    tax_amount = new_tax_amount,
    tax_inclusive_amount = new_tax_exclusive + new_tax_amount,
    invoice_issue_date = COALESCE(invoice_issue_date, CURRENT_DATE),
    tax_point_date = COALESCE(tax_point_date, CURRENT_DATE)
  WHERE id = order_uuid;

  -- Upsert tax subtotal for the order
  IF merchant_vat_status = 'registered' THEN
    INSERT INTO order_tax_subtotals (order_id, vat_category_code, vat_rate, taxable_amount, tax_amount)
    SELECT
      order_uuid,
      vat_category_code,
      vat_rate,
      SUM(line_extension_amount),
      SUM(vat_amount)
    FROM order_items
    WHERE order_id = order_uuid
    GROUP BY vat_category_code, vat_rate
    ON CONFLICT (order_id, vat_category_code, vat_rate)
    DO UPDATE SET
      taxable_amount = EXCLUDED.taxable_amount,
      tax_amount = EXCLUDED.tax_amount;
  END IF;

  RETURN NEW;
END;
$$;

-- Add unique constraint for upsert to work
ALTER TABLE order_tax_subtotals
DROP CONSTRAINT IF EXISTS order_tax_subtotals_unique_category;
ALTER TABLE order_tax_subtotals
ADD CONSTRAINT order_tax_subtotals_unique_category
UNIQUE (order_id, vat_category_code, vat_rate);

-- Create triggers for order tax updates
DROP TRIGGER IF EXISTS trigger_update_order_tax_totals_insert ON order_items;
DROP TRIGGER IF EXISTS trigger_update_order_tax_totals_update ON order_items;
DROP TRIGGER IF EXISTS trigger_update_order_tax_totals_delete ON order_items;

CREATE TRIGGER trigger_update_order_tax_totals_insert
  AFTER INSERT ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_order_tax_totals();

CREATE TRIGGER trigger_update_order_tax_totals_update
  AFTER UPDATE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_order_tax_totals();

CREATE TRIGGER trigger_update_order_tax_totals_delete
  AFTER DELETE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_order_tax_totals();

-- ============================================
-- 7. INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_merchants_tin
ON merchants(tax_identification_number) WHERE tax_identification_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_merchants_vat_status
ON merchants(vat_registration_status);

CREATE INDEX IF NOT EXISTS idx_orders_firs_status
ON orders(firs_submission_status) WHERE firs_submission_status != 'not_submitted';

CREATE INDEX IF NOT EXISTS idx_orders_invoice_date
ON orders(invoice_issue_date);

-- ============================================
-- 8. GRANT PERMISSIONS
-- ============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON order_tax_subtotals TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
