export const STOREFRONT_PRODUCTS_SELECT = `
  id,
  created_at,
  name,
  description,
  price,
  compare_at_price,
  images,
  image_hint,
  category,
  category_id,
  brand,
  stock,
  stock_quantity,
  slug,
  status,
  condition,
  has_variants,
  sku,
  manage_stock,
  low_stock_threshold,
  specifications,
  has_condition_offers,
  available_conditions,
  variant_model,
  offers,
  color,
  color_images,
  variant_attributes,
  categories:category_id(id, name, slug),
  product_categories (
    categories (
      id,
      name,
      slug
    )
  )
`;
