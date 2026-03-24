/** Supabase select projection for feed products. Exported for regression testing. */
export const FEED_PRODUCTS_SELECT = `id, name, description, slug, price, compare_at_price,
  brand, gtin, mpn, sku, stock, stock_quantity, manage_stock, condition,
  google_product_category, category, weight_value, weight_unit, updated_at`;
