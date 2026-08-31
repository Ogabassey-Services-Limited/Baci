import type { Route } from 'next';
import { HoverPrefetchLink } from '@/components/ui/hover-prefetch-link';
import { formatMerchantCurrency } from '@/lib/resolve-merchant-currency';
import { getStorefrontProductHref } from '@/lib/storefront-product-href';

type RelatedProduct = {
  category_slug?: string | null;
  id: string;
  name: string;
  price?: number | null;
  compare_at_price?: number | null;
  manage_stock?: boolean | null;
  stock?: number | null;
  slug: string;
};

type BlogRelatedProductsProps = {
  basePath: string;
  currencySource?: { country?: string | null; payout_currency?: string | null };
  products: RelatedProduct[];
};

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
              slug: product.slug,
              category_slug: product.category_slug ?? undefined,
            },
            basePath
          );

          return (
            <li key={product.id}>
              <HoverPrefetchLink
                href={href as Route}
                className="block rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <span className="flex items-center justify-between gap-3">
                  <span>{product.name}</span>
                  {typeof product.price === 'number' &&
                  Number.isFinite(product.price) &&
                  currencySource ? (
                    <span className="text-muted-foreground text-xs">
                      {formatMerchantCurrency(product.price, currencySource)}
                    </span>
                  ) : null}
                </span>
              </HoverPrefetchLink>
              {product.manage_stock && product.stock === 0 ? (
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
