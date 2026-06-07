import { PRODUCT_KEY_SPECS_RELATION_SELECT } from '@/lib/product-key-specs-select';

export const STOREFRONT_PRODUCTS_FULL_SELECT = `
  id,
  merchant_id,
  created_at,
  updated_at,
  name,
  slug,
  description,
  images,
  category,
  category_id,
  brand,
  price,
  compare_at_price,
  condition,
  stock,
  stock_quantity,
  status,
  manage_stock,
  low_stock_threshold,
  image_hint,
  specifications,
  ${PRODUCT_KEY_SPECS_RELATION_SELECT},
  has_variants,
  sku,
  has_condition_offers,
  offers,
  color,
  color_images,
  variant_attributes,
  available_conditions,
  variant_model,
  categories:category_id(id, name, slug),
  product_categories (
    categories (
      id,
      name,
      slug
    )
  )
`;
