export const WEB_ORDER_COLUMNS =
  'id, created_at, updated_at, merchant_id, customer_id, order_number, customer_name, customer_email, customer_phone, shipping_status, payment_status, total, subtotal, shipping_fee, tax_amount, discount_amount, shipping_address, source, notes, payment_method, ad_tracking, currency, exchange_rate, original_currency, original_total, selected_quote_id, shipping_provider, tracking_number, tracking_token, amount_paid, wallet_amount_used';

export const WEB_ORDER_ITEMS_COLUMNS =
  'id, created_at, order_id, product_id, condition, variant_name, name, price, quantity, fulfillment_data, has_assurance, assurance_fee';

export const WEB_ORDER_WITH_ITEMS_QUERY = `${WEB_ORDER_COLUMNS}, order_items(${WEB_ORDER_ITEMS_COLUMNS})`;

export const MOBILE_ADMIN_ORDER_COLUMNS =
  'id, order_number, merchant_id, customer_id, customer_name, customer_email, customer_phone, shipping_status, payment_status, total, subtotal, shipping_fee, tax_amount, discount_amount, currency, source, payment_method, notes, is_credit_order, shipping_address, recorded_by_user_id, wallet_amount_used, fulfillment_details, created_at, updated_at';

type ShippingAddressLike = {
  address?: unknown;
  address_line1?: unknown;
};

function isShippingAddressLike(value: unknown): value is ShippingAddressLike {
  return typeof value === 'object' && value !== null;
}

export function extractOrderDeliveryAddress(
  shippingAddress: unknown
): string | null {
  if (typeof shippingAddress === 'string') {
    const trimmed = shippingAddress.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (!isShippingAddressLike(shippingAddress)) {
    return null;
  }

  const address =
    typeof shippingAddress.address === 'string'
      ? shippingAddress.address.trim()
      : '';
  const fallbackAddress =
    typeof shippingAddress.address_line1 === 'string'
      ? shippingAddress.address_line1.trim()
      : '';
  const resolvedAddress = address || fallbackAddress;

  return resolvedAddress.length > 0 ? resolvedAddress : null;
}
