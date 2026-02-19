// Defines safe columns for order queries to prevent over-fetching
export const ORDER_COLUMNS =
  'id, created_at, updated_at, merchant_id, customer_id, order_number, customer_name, customer_email, customer_phone, shipping_status, payment_status, total, subtotal, shipping_fee, tax_amount, discount_amount, shipping_address, source, notes, payment_method, ad_tracking, currency, exchange_rate, original_currency, original_total, selected_quote_id, shipping_provider, tracking_number, tracking_token, payment_reference';

export const ORDER_ITEMS_COLUMNS =
  'id, created_at, order_id, product_id, name, price, quantity, fulfillment_data, has_assurance, assurance_fee';

// Include order_items relation (keeping the key 'order_items' to match existing API contract)
export const ORDER_WITH_ITEMS_QUERY = `${ORDER_COLUMNS}, order_items(${ORDER_ITEMS_COLUMNS})`;
