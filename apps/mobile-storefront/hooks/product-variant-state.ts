interface VariantStateCarrier {
  has_variants?: unknown;
  variant_model?: unknown;
}

export function isVariantBearingProduct(product: VariantStateCarrier): boolean {
  return (
    product.has_variants === true || product.variant_model === 'sku_matrix'
  );
}
