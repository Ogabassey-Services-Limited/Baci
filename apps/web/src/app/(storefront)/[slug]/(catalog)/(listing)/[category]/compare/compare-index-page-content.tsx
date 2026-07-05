import Link from 'next/link';
import { asRoute } from '@/lib/routes';
import type { CompareLinkGraphEntry } from '@/lib/storefront-link-modules/compare-link-graph';

interface CompareIndexPageContentProps {
  categoryName: string;
  categoryHref: string;
  compareLinks: CompareLinkGraphEntry[];
  merchantName: string;
  pathPrefix: string;
}

function resolveStorefrontHref(pathPrefix: string, href: string) {
  if (href.startsWith('http://') || href.startsWith('https://')) {
    return href;
  }

  return href === '/' ? pathPrefix || '/' : `${pathPrefix}${href}`;
}

export function CompareIndexPageContent({
  categoryName,
  categoryHref,
  compareLinks,
  merchantName,
  pathPrefix,
}: CompareIndexPageContentProps) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="max-w-3xl space-y-3">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {categoryName} comparisons
        </h1>
        <p className="text-base text-store-background-text/65 sm:text-lg">
          Compare prices, specs, condition, warranty, and buying fit across{' '}
          {categoryName.toLowerCase()} available from {merchantName}.
        </p>
      </header>

      {compareLinks.length > 0 ? (
        <section className="mt-8 grid gap-4 md:grid-cols-2">
          {compareLinks.map((link) => (
            <article
              key={link.href}
              className="rounded-lg border border-store-background-text/10 p-5"
            >
              <Link
                className="text-base font-semibold text-store-primary hover:underline"
                href={asRoute(resolveStorefrontHref(pathPrefix, link.href))}
                prefetch={false}
              >
                {link.label}
              </Link>
              <p className="mt-2 text-sm text-store-background-text/60">
                {link.description}
              </p>
            </article>
          ))}
        </section>
      ) : (
        <section className="mt-8 rounded-lg border border-store-background-text/10 p-6">
          <p className="text-sm text-store-background-text/60">
            No comparison guides are ready for this category yet.
          </p>
          <Link
            className="mt-4 inline-flex text-sm font-semibold text-store-primary hover:underline"
            href={asRoute(resolveStorefrontHref(pathPrefix, categoryHref))}
            prefetch={false}
          >
            Browse {categoryName}
          </Link>
        </section>
      )}
    </main>
  );
}
