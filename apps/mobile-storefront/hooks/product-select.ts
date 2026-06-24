export const PRODUCT_SELECT = `
  id, name, slug, description, price, compare_at_price, created_at,
  images, brand, condition, has_condition_offers, variant_model, available_conditions, average_rating, review_count, status, specifications,
  has_variants, variant_attributes, manage_stock, stock, stock_quantity,
  variants:product_variants!product_variants_product_id_fkey (
    id,
    product_id,
    merchant_id,
    condition,
    sku,
    price_override,
    primary_image,
    images,
    stock_quantity,
    attributes
  ),
  categories (id, name, slug)
`;

export const PRODUCT_DETAIL_SELECT = `
  id, name, slug, description, price, compare_at_price,
  images, brand, color, condition, average_rating, review_count, status, specifications,
  has_variants, variant_attributes, manage_stock, stock, stock_quantity,
  color_images, has_condition_offers, variant_model, available_conditions,
  offers:product_offers (
    id,
    condition,
    price,
    compare_at_price,
    stock_quantity,
    images,
    condition_notes,
    grade
  ),
  variants:product_variants!product_variants_product_id_fkey (
    id,
    product_id,
    merchant_id,
    condition,
    sku,
    price_override,
    primary_image,
    images,
    stock_quantity,
    attributes
  ),
  categories (id, name, slug)
`;
