-- Backfill order_items from orders.items JSONB column
INSERT INTO order_items (order_id, product_id, name, quantity, price)
SELECT
  id as order_id,
  -- Try to find product ID in various fields, cast to UUID if it looks like one, else NULL
  CASE 
    WHEN item->>'product_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN (item->>'product_id')::uuid
    WHEN item->>'productId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN (item->>'productId')::uuid
    WHEN item->>'id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN (item->>'id')::uuid
    ELSE NULL
  END as product_id,
  COALESCE(item->>'name', item->>'productName', 'Unknown Product') as name,
  COALESCE((item->>'quantity')::int, 1) as quantity,
  COALESCE((item->>'price')::decimal, 0) as price
FROM orders,
LATERAL jsonb_array_elements(items) as item
WHERE NOT EXISTS (SELECT 1 FROM order_items WHERE order_items.order_id = orders.id);
