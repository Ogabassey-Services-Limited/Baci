// Explicit column lists for product queries to prevent over-fetching (NEVER select('*'))
// This aligns with the 'Warden' data integrity philosophy.

export const PRODUCT_COLUMNS =
  'id, merchant_id, created_at, updated_at, name, description, status, is_active, price, manage_stock, stock_quantity, min_order_quantity, image_small, image_large, image_hint, images, brand, gtin, mpn, google_product_category, has_variants, category, color, sku, slug, compare_at_price, cost_price, low_stock_threshold, weight_value, weight_unit, dimensions, taxable, tax_code, condition, condition_detail, meta_title, meta_description, keywords, canonical_url, schema_markup';

export const VARIANT_COLUMNS =
  'id, product_id, merchant_id, attributes, price_override, cost_price, stock_quantity, sku, primary_image, images';

export const PRODUCT_WITH_VARIANTS_QUERY = `${PRODUCT_COLUMNS}, variants:product_variants(${VARIANT_COLUMNS})`;
