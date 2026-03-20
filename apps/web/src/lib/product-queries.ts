// Explicit column lists for product queries to prevent over-fetching (NEVER select('*'))

export const PRODUCT_COLUMNS =
  'id, created_at, updated_at, merchant_id, name, description, price, compare_at_price, cost_price, stock, stock_quantity, manage_stock, min_order_quantity, low_stock_threshold, sku, slug, status, is_active, condition, condition_detail, brand, category, color, has_variants, images, image_small, image_large, image_hint, weight_value, weight_unit, dimensions, taxable, tax_code, meta_title, meta_description, keywords, canonical_url, schema_markup, gtin, mpn, google_product_category, fulfillment_details';

export const PRODUCT_VARIANT_COLUMNS =
  'id, created_at, updated_at, product_id, merchant_id, attributes, price_override, cost_price, stock_quantity, sku, primary_image, images';

export const PRODUCT_WITH_VARIANTS_QUERY = `${PRODUCT_COLUMNS}, variants:product_variants(${PRODUCT_VARIANT_COLUMNS})`;
