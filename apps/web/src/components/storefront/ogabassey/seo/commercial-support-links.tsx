'use client';

import type { CommercialSupportLink } from '@/lib/storefront-compare/build-commercial-support-links';

interface CommercialSupportLinksProps {
  heading: string;
  links: CommercialSupportLink[];
}

export function CommercialSupportLinks({
  heading,
  links,
}: CommercialSupportLinksProps) {
  if (links.length === 0) {
    return null;
  }

  const headingId = heading.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return (
    <section
      aria-labelledby={headingId}
      className="mt-10 border-t border-store-background-text/12 pt-8"
    >
      <h2
        id={headingId}
        className="text-xl font-semibold text-store-background-text"
      >
        {heading}
      </h2>
      <ul className="mt-4 space-y-3">
        {links.map((link) => (
          <li key={link.href}>
            <a
              className="text-sm font-medium text-store-primary underline-offset-4 hover:underline"
              href={link.href}
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
