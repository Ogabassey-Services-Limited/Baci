export type SeoIndexBlocker =
  | 'store_unpublished'
  | 'missing_canonical_url'
  | 'missing_merchant_name'
  | 'category_unavailable'
  | 'category_data_unavailable'
  | 'category_empty'
  | 'product_inactive'
  | 'missing_product_name'
  | 'missing_product_canonical_url';
