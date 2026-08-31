import type { Route } from 'next';
import { HoverPrefetchLink } from '@/components/ui/hover-prefetch-link';
import { getEffectiveStock } from '@/lib/product-stock';
import { formatMerchantCurrency } from '@/lib/resolve-merchant-currency';
import { getStorefrontProductHref } from '@/lib/storefront-product-href';
import { getProductPriceRange } from '@/lib/storefront-product-price-seo';
import type { BlogRelatedProduct } from './blog-related-product';

type BlogRelatedProductsProps = {
  basePath: string;
  currencySource?: { country?: string | null; payout_currency?: string | null };
  products: BlogRelatedProduct[];
};

function formatRelatedProductPrice(
  product: BlogRelatedProduct,
  currencySource: BlogRelatedProductsProps['currencySource']
) {
  if (!currencySource) return null;

  const range = getProductPriceRange(product);
  if (range) {
    const min = formatMerchantCurrency(range.min, currencySource);
    return range.hasRange
      ? `${min} - ${formatMerchantCurrency(range.max, currencySource)}`
      : min;
  }

  return typeof product.price === 'number' && Number.isFinite(product.price)
    ? formatMerchantCurrency(product.price, currencySource)
    : null;
}

export function BlogRelatedProducts({
  basePath,
  currencySource,
  products,
}: BlogRelatedProductsProps) {
  return (
    <section aria-labelledby="related-products-heading" className="mt-10">
      <h2 id="related-products-heading" className="mb-4 text-2xl font-bold">
        Popular Products Mentioned
      </h2>
      <ul className="grid gap-3 md:grid-cols-2">
        {products.map((product) => {
          const href = getStorefrontProductHref(
            {
              id: product.id,
              name: product.name,
              slug: product.slug ?? undefined,
              category_slug: product.category_slug ?? undefined,
            },
            basePath
          );
          const formattedPrice = formatRelatedProductPrice(
            product,
            currencySource
          );

          return (
            <li key={product.id}>
              <HoverPrefetchLink
                href={href as Route}
                className="block rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <span className="flex items-center justify-between gap-3">
                  <span>{product.name}</span>
                  {formattedPrice ? (
                    <span className="text-muted-foreground text-xs">
                      {formattedPrice}
                    </span>
                  ) : null}
                </span>
              </HoverPrefetchLink>
              {product.manage_stock &&
              getEffectiveStock(product) === 0 &&
              product.has_purchasable_condition_offer !== true &&
              product.has_purchasable_variant !== true &&
              (!product.has_condition_offers ||
                product.has_purchasable_condition_offer === false) &&
              (!product.has_variants ||
                product.has_purchasable_variant === false) ? (
                <span className="mt-1 block px-4 text-xs text-muted-foreground">
                  Currently unavailable
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
