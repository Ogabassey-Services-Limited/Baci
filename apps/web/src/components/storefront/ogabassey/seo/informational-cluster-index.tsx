import type { BlogClusterCollection } from '@/lib/storefront-content/content-cluster-types';

interface InformationalClusterIndexProps {
  collections: BlogClusterCollection[];
}

export function InformationalClusterIndex({
  collections,
}: InformationalClusterIndexProps) {
  if (collections.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="guide-collections"
      className="mx-auto mt-10 max-w-[1400px] px-4 md:px-6"
    >
      <div className="rounded-3xl border border-store-background-text/10 bg-store-background p-5 md:p-6">
        <h2
          id="guide-collections"
          className="text-2xl font-semibold text-store-background-text"
        >
          Guide collections
        </h2>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {collections.map((collection) => (
            <section
              key={collection.categorySlug}
              aria-labelledby={`guide-${collection.categorySlug}`}
              className="rounded-2xl border border-store-background-text/10 p-4"
            >
              <h3
                id={`guide-${collection.categorySlug}`}
                className="text-lg font-semibold text-store-background-text"
              >
                <a
                  className="underline-offset-4 hover:underline"
                  href={collection.categoryHref}
                >
                  {collection.heading}
                </a>
              </h3>
              <ul className="mt-4 space-y-3">
                {collection.guides.map((guide) => (
                  <li key={guide.href}>
                    <a
                      className="text-sm font-medium text-store-primary underline-offset-4 hover:underline"
                      href={guide.href}
                    >
                      {guide.title}
                    </a>
                    <p className="mt-1 text-sm text-store-background-text/70">
                      {guide.description}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}
