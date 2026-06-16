/**
 * Sanitization utility to redact sensitive fulfillment identifiers (IMEI, SN, etc.)
 * from products, variants, orders, and order items before they are sent to public/storefront surfaces.
 */

/**
 * Checks if a value is a plain object.
 */
function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

/**
 * Creates a shallow copy of a plain object.
 */
function cloneObject(obj: Record<string, unknown>): Record<string, unknown> {
  return { ...obj };
}

/**
 * Sanitizes a product object by removing sensitive fulfillment_details.
 */
export function sanitizePublicProduct<T>(product: T): T {
  if (!product) return product;

  if (Array.isArray(product)) {
    return product.map(sanitizePublicProduct) as unknown as T;
  }

  if (isObject(product)) {
    const copy = cloneObject(product);
    // Redact fulfillment details
    if ('fulfillment_details' in copy) {
      delete copy.fulfillment_details;
    }

    // Recursively sanitize nested variants if present
    if ('variants' in copy && Array.isArray(copy.variants)) {
      copy.variants = copy.variants.map(sanitizePublicProductVariant);
    }

    return copy as unknown as T;
  }

  return product;
}

/**
 * Sanitizes a product variant object by removing any sensitive columns.
 */
export function sanitizePublicProductVariant<T>(variant: T): T {
  if (!variant) return variant;

  if (Array.isArray(variant)) {
    return variant.map(sanitizePublicProductVariant) as unknown as T;
  }

  if (isObject(variant)) {
    const copy = cloneObject(variant);
    if ('fulfillment_details' in copy) {
      delete copy.fulfillment_details;
    }
    return copy as unknown as T;
  }

  return variant;
}

/**
 * Sanitizes an order item by removing sensitive fulfillment_data.
 */
export function sanitizePublicOrderItem<T>(item: T): T {
  if (!item) return item;

  if (Array.isArray(item)) {
    return item.map(sanitizePublicOrderItem) as unknown as T;
  }

  if (isObject(item)) {
    const copy = cloneObject(item);
    // Redact fulfillment data
    if ('fulfillment_data' in copy) {
      delete copy.fulfillment_data;
    }
    return copy as unknown as T;
  }

  return item;
}

/**
 * Sanitizes an order by removing sensitive fulfillment_details and sanitizing nested order_items.
 */
export function sanitizePublicOrder<T>(order: T): T {
  if (!order) return order;

  if (Array.isArray(order)) {
    return order.map(sanitizePublicOrder) as unknown as T;
  }

  if (isObject(order)) {
    const copy = cloneObject(order);
    // Redact order level fulfillment details
    if ('fulfillment_details' in copy) {
      delete copy.fulfillment_details;
    }

    // Recursively sanitize order items if present
    if ('order_items' in copy && Array.isArray(copy.order_items)) {
      copy.order_items = copy.order_items.map(sanitizePublicOrderItem);
    }
    if ('items' in copy && Array.isArray(copy.items)) {
      copy.items = copy.items.map(sanitizePublicOrderItem);
    }

    return copy as unknown as T;
  }

  return order;
}
