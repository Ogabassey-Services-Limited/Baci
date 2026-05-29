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
      className="ogabassey-pdp-support-links"
    >
      <h2 id={headingId} className="ogabassey-pdp-support-links__title">
        {heading}
      </h2>
      <ul className="ogabassey-pdp-support-links__list">
        {links.map((link) => (
          <li key={link.href}>
            <a
              className="ogabassey-pdp-semantic-card__link"
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
