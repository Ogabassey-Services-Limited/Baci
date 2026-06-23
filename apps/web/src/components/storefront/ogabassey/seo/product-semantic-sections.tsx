import type { ProductSemanticModel } from '@/lib/storefront-product/product-semantic-types';
import { CategoryHubCardGrid } from './category-hub-card-grid';
import { CommercialSupportLinks } from './commercial-support-links';

interface ProductSemanticSectionsProps {
  model: ProductSemanticModel;
}

export function ProductSemanticSections({
  model,
}: ProductSemanticSectionsProps) {
  const hasCards = Boolean(
    model.alternatives || model.sameBrand || model.samePrice,
  );
  const hasGuideLinks = model.guideLinks.length > 0;

  if (!model.supportLinks.length && !hasGuideLinks && !hasCards) {
    return null;
  }

  return (
    <section className="ogabassey-pdp-semantic-sections">
      {hasGuideLinks ? (
        <section
          aria-labelledby="product-guide-links"
          className="ogabassey-pdp-semantic-card"
        >
          <h2
            id="product-guide-links"
            className="ogabassey-pdp-semantic-card__title"
          >
            Buyer guides
          </h2>
          <ul className="ogabassey-pdp-semantic-card__link-list">
            {model.guideLinks.map((link) => (
              <li key={link.href}>
                <a
                  className="ogabassey-pdp-semantic-card__link"
                  href={link.href}
                >
                  {link.title}
                </a>
                <p className="ogabassey-pdp-semantic-card__description">
                  {link.description}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {model.alternatives ? (
        <CategoryHubCardGrid
          title={model.alternatives.heading}
          cards={model.alternatives.cards}
        />
      ) : null}

      {model.sameBrand ? (
        <CategoryHubCardGrid
          title={model.sameBrand.heading}
          cards={model.sameBrand.cards}
        />
      ) : null}

      {model.samePrice ? (
        <CategoryHubCardGrid
          title={model.samePrice.heading}
          cards={model.samePrice.cards}
        />
      ) : null}

      <CommercialSupportLinks
        heading="Compare and Buying Guides"
        links={model.supportLinks}
      />
    </section>
  );
}
