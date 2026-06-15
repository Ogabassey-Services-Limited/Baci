-- Orphan Paid Orders Report
-- Orders marked as "paid" but with no corresponding transaction records
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/bnkfrzresmmoepferhlo/sql

SELECT
  o.id,
  o.order_number,
  o.payment_status,
  o.payment_method,
  o.total,
  o.customer_name,
  o.customer_email,
  o.created_at
FROM orders o
LEFT JOIN transactions t ON t.order_id = o.id
WHERE o.payment_status = 'paid'
  AND t.id IS NULL
ORDER BY o.created_at DESC;

-- Summary count
SELECT
  COUNT(*) as orphan_orders_count,
  SUM(total) as total_amount
FROM orders o
LEFT JOIN transactions t ON t.order_id = o.id
WHERE o.payment_status = 'paid'
  AND t.id IS NULL;
