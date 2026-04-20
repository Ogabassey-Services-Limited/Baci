/** Supabase select projection for feed products. Exported for regression testing. */
export const FEED_PRODUCTS_SELECT = `id, name, description, slug, price, compare_at_price,
  brand, gtin, mpn, sku, stock, stock_quantity, manage_stock, condition,
  has_condition_offers, variant_model, available_conditions,
  google_product_category, category, category_slug, color, product_key_specs,
  weight_value, weight_unit,
  product_categories(categories(name, slug)), updated_at`;
