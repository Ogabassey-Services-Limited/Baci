import type { Product } from '@/lib/products';
import { stripHtmlTags } from '@/lib/sanitize-core';
import { buildProductPriceSeoCopy } from '@/lib/storefront-product-price-seo';
import { DEFAULT_STORE_NAME } from '@/lib/storefront-seo-defaults';

interface GenericProductRouteSummaryProps {
  currency: string;
  merchant: {
    business_name?: string | null;
    country?: string | null;
  };
  product: Product;
}

export function GenericProductRouteSummary({
  currency,
  merchant,
  product,
}: GenericProductRouteSummaryProps) {
  const priceSeoCopy = buildProductPriceSeoCopy({
    product,
    merchantDisplayName: merchant.business_name || DEFAULT_STORE_NAME,
    categoryName: product.category || 'All Products',
    currency,
    country: merchant.country,
  });
  const plainDescription = stripHtmlTags(product.description)
    .replace(/\s+/g, ' ')
    .trim();

  return (
    <article className="sr-only" aria-label={`${product.name} summary`}>
      <p>{priceSeoCopy.answer}</p>
      {plainDescription ? <p>{plainDescription}</p> : null}
      <dl>
        <dt>Brand</dt>
        <dd>{product.brand || 'OgaBassey'}</dd>
        <dt>Category</dt>
        <dd>{product.category || 'Electronics'}</dd>
        <dt>Condition</dt>
        <dd>{product.condition || 'New'}</dd>
        <dt>Price</dt>
        <dd>{priceSeoCopy.priceText || 'Contact for price'}</dd>
      </dl>
    </article>
  );
}
