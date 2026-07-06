import { headers } from 'next/headers';
import Link from 'next/link';
import { toRequestRelativeHref } from '@/app/(storefront)/[slug]/(catalog)/(listing)/compare/compare-page-content-helpers';
import { asRoute } from '@/lib/routes';
import type { CompareLinkGraphEntry } from '@/lib/storefront-link-modules/compare-link-graph';
import { getStorefrontPathPrefix } from '@/lib/storefront-path-prefix';

interface CompareRelatedLinksProps {
  links: CompareLinkGraphEntry[];
  merchantCustomDomain?: string | null;
  merchantSlug: string;
  storeUrl: string;
}

export async function CompareRelatedLinks({
  links,
  merchantCustomDomain,
  merchantSlug,
  storeUrl,
}: CompareRelatedLinksProps) {
  if (links.length === 0) {
    return null;
  }

  const pathPrefix = getStorefrontPathPrefix(await headers(), {
    custom_domain: merchantCustomDomain,
    slug: merchantSlug,
  });

  return (
    <section
      aria-labelledby="related-comparisons-heading"
      className="mt-10 space-y-4"
    >
      <h2 className="text-2xl font-semibold" id="related-comparisons-heading">
        More comparisons to check
      </h2>
      <ul className="grid gap-4 md:grid-cols-2">
        {links.map((link) => (
          <li
            className="space-y-2 rounded-2xl border border-store-border p-4"
            key={link.href}
          >
            <Link
              className="text-base font-semibold text-store-primary underline-offset-4 hover:underline"
              href={asRoute(
                toRequestRelativeHref(link.href, storeUrl, pathPrefix)
              )}
              prefetch={false}
            >
              {link.label}
            </Link>
            <p className="text-sm text-store-background-text/70">
              {link.description}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
