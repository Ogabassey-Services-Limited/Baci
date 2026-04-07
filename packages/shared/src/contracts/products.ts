export const MOBILE_ADMIN_PRODUCT_COLUMNS =
  'id, name, description, price, compare_at_price, cost_price, stock_quantity, stock, sku, slug, images, status, category, category_id, brand, brand_id, fulfillment_details, color, condition, variant_attributes, has_variants, manage_stock, low_stock_threshold, created_at, updated_at';

export const MOBILE_ADMIN_PRODUCT_WITH_RELATIONS_QUERY = `${MOBILE_ADMIN_PRODUCT_COLUMNS}, categories(name), brands(name)`;

export const WEB_PRODUCT_COLUMNS =
  'id, created_at, updated_at, merchant_id, name, description, price, compare_at_price, cost_price, stock, stock_quantity, manage_stock, low_stock_threshold, sku, slug, status, condition, condition_detail, brand, category, color, has_variants, images, image_hint, weight_value, weight_unit, dimensions, taxable, tax_code, meta_title, meta_description, keywords, canonical_url, schema_markup, gtin, mpn, google_product_category, fulfillment_details';

export const WEB_PRODUCT_VARIANT_COLUMNS =
  'id, created_at, updated_at, product_id, merchant_id, attributes, price_override, cost_price, stock_quantity, sku, primary_image, images';

export const WEB_PRODUCT_WITH_VARIANTS_QUERY = `${WEB_PRODUCT_COLUMNS}, variants:product_variants(${WEB_PRODUCT_VARIANT_COLUMNS})`;
