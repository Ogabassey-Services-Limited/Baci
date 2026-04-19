-- Add financial breakdown columns to orders table (e-commerce best practice)
-- This follows industry best practices for order schema design:
-- 1. Historical Accuracy - Prices, shipping, discounts can change over time
-- 2. Audit Trail - Need exact breakdown for accounting and refunds
-- 3. Analytics - Analyze shipping costs, discount usage, tax patterns
-- 4. Partial Refunds - Need components to process correctly

-- Add the missing financial columns
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12, 2) DEFAULT 0;

-- Add descriptive comments for documentation
COMMENT ON COLUMN public.orders.subtotal IS 'Sum of all item prices at time of order (before shipping, tax, discounts)';
COMMENT ON COLUMN public.orders.shipping_fee IS 'Shipping cost charged for this order';
COMMENT ON COLUMN public.orders.discount_amount IS 'Total discount applied to the order';
COMMENT ON COLUMN public.orders.tax_amount IS 'Total tax charged on the order';
COMMENT ON COLUMN public.orders.total IS 'Final amount paid: subtotal + shipping_fee + tax_amount - discount_amount';

-- Backfill existing orders: set subtotal = total (assuming no separate shipping/discount was tracked)
UPDATE public.orders 
SET subtotal = total 
WHERE subtotal IS NULL OR subtotal = 0;
