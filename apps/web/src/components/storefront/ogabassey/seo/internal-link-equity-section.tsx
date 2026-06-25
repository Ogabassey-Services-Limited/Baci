import Link from 'next/link';
import { asRoute } from '@/lib/routes';

interface InternalLinkEquityLink {
  href: string;
  label: string;
}

interface InternalLinkEquityGroup {
  title: string;
  description: string;
  links: InternalLinkEquityLink[];
}

interface InternalLinkEquitySectionProps {
  groups: InternalLinkEquityGroup[];
  pathPrefix: string;
}

function buildHeadingId(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function resolveInternalLinkHref(pathPrefix: string, href: string) {
  if (href === '/') {
    return pathPrefix || '/';
  }

  return `${pathPrefix}${href}`;
}

export function InternalLinkEquitySection({
  groups,
  pathPrefix,
}: InternalLinkEquitySectionProps) {
  const visibleGroups = groups.filter((group) => group.links.length > 0);

  if (visibleGroups.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="ogabassey-internal-link-equity-heading"
      className="mt-8 rounded-3xl border border-store-background-text/10 bg-store-background p-5 shadow-sm"
    >
      <div className="max-w-3xl space-y-2">
        <h2
          id="ogabassey-internal-link-equity-heading"
          className="text-lg font-semibold text-store-background-text"
        >
          Explore more buying paths
        </h2>
        <p className="text-sm leading-6 text-store-background-text/65">
          Shortcuts to products, categories, comparisons, and buying resources
          that shoppers often need while researching Ogabassey devices.
        </p>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {visibleGroups.map((group) => {
          const headingId = `${buildHeadingId(group.title)}-links`;

          return (
            <section key={group.title} aria-labelledby={headingId}>
              <h3
                id={headingId}
                className="text-sm font-semibold text-store-background-text"
              >
                {group.title}
              </h3>
              <p className="mt-1 text-xs leading-5 text-store-background-text/55">
                {group.description}
              </p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={asRoute(
                        resolveInternalLinkHref(pathPrefix, link.href)
                      )}
                      prefetch={false}
                      className="text-sm font-medium text-store-primary underline-offset-4 hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </section>
  );
}
