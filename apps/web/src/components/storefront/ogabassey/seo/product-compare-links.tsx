import type { CompareLinkGraphEntry } from '@/lib/storefront-link-modules/compare-link-graph';
import { resolveStorefrontPathHref } from '@/lib/storefront-path-prefix';

interface ProductCompareLinksProps {
  productName: string;
  links: CompareLinkGraphEntry[];
  merchantName: string;
  pathPrefix?: string;
}

export const MAX_PRODUCT_COMPARE_LINKS = 8;

export function ProductCompareLinks({
  productName,
  links,
  merchantName,
  pathPrefix = '',
}: ProductCompareLinksProps) {
  if (links.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="product-comparisons-heading"
      className="rounded-lg border border-store-background-text/10 p-5"
    >
      <h2 id="product-comparisons-heading" className="text-xl font-semibold">
        Popular comparisons for this product
      </h2>
      <p className="mt-1 text-sm text-store-background-text/60">
        Compare {productName} with similar {merchantName} options before
        choosing.
      </p>
      <ul className="mt-4 space-y-3">
        {links.slice(0, MAX_PRODUCT_COMPARE_LINKS).map((link) => (
          <li key={link.href}>
            <a
              className="text-sm font-semibold text-store-primary hover:underline"
              href={resolveStorefrontPathHref(pathPrefix, link.href)}
            >
              {link.label}
            </a>
            <p className="mt-1 text-xs text-store-background-text/60">
              {link.description}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
