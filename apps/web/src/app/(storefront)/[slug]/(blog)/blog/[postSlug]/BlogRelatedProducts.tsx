import { HoverPrefetchLink } from '@/components/ui/hover-prefetch-link';
import { formatCurrency } from '@/lib/currency';
import type { RelatedBlogProduct } from '@/lib/related-blog-products';
import { getStorefrontProductHref } from '@/lib/storefront-product-href';

interface BlogRelatedProductsProps {
  basePath: string;
  countryCode?: string | null;
  payoutCurrency?: string | null;
  products: readonly RelatedBlogProduct[];
}

function getCurrentPrice(product: RelatedBlogProduct) {
  return typeof product.price === 'number' && Number.isFinite(product.price)
    ? product.price
    : null;
}

function getCompareAtPrice(product: RelatedBlogProduct, price: number | null) {
  const compareAtPrice = product.compare_at_price;
  return price !== null &&
    typeof compareAtPrice === 'number' &&
    Number.isFinite(compareAtPrice) &&
    compareAtPrice > price
    ? compareAtPrice
    : null;
}

export function BlogRelatedProducts({
  basePath,
  countryCode,
  payoutCurrency,
  products,
}: BlogRelatedProductsProps) {
  if (products.length === 0) return null;

  return (
    <section aria-labelledby="related-products-heading" className="mt-10">
      <h2 id="related-products-heading" className="mb-2 text-2xl font-bold">
        Popular Products Mentioned
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Prices below come from the live catalog. Availability, selected variants
        and final checkout prices can change, so open the product page before
        buying.
      </p>
      <ul className="grid gap-3 md:grid-cols-2">
        {products.map((product) => {
          const price = getCurrentPrice(product);
          const compareAtPrice = getCompareAtPrice(product, price);
          const formattedCompareAtPrice =
            compareAtPrice === null
              ? null
              : formatCurrency(
                  compareAtPrice,
                  countryCode,
                  undefined,
                  payoutCurrency
                );
          const href = getStorefrontProductHref(
            { ...product, category_slug: product.category_slug ?? undefined },
            basePath
          );

          return (
            <li
              key={product.id}
              className="rounded-xl border border-border px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <HoverPrefetchLink
                  href={href}
                  className="text-sm font-medium text-foreground transition-colors hover:text-primary"
                >
                  {product.name}
                </HoverPrefetchLink>
                {price !== null && (
                  <span className="shrink-0 text-right text-sm font-semibold">
                    <span className="sr-only">Current price: </span>
                    {formatCurrency(
                      price,
                      countryCode,
                      undefined,
                      payoutCurrency
                    )}
                    {formattedCompareAtPrice !== null && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground line-through">
                        <span className="sr-only">Original price: </span>
                        {formattedCompareAtPrice}
                      </span>
                    )}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
