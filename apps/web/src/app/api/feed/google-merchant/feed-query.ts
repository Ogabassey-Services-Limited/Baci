/** Supabase select projection for feed products. Exported for regression testing. */
export const FEED_PRODUCTS_SELECT = `id, name, description, slug, category_slug, price, compare_at_price,
  brand, gtin, mpn, sku, stock, stock_quantity, manage_stock, condition,
  has_condition_offers, variant_model, available_conditions,
  google_product_category, category, color,
  product_key_specs(screen_size_inches, ram_gb, storage_gb, main_camera_mp, weight_g, available_colors, display_resolution, front_camera_mp),
  weight_value, weight_unit,
  product_categories(categories(name, slug)), updated_at`;
