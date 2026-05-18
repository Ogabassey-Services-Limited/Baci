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

  if (
    !model.trustBullets.length &&
    !model.supportLinks.length &&
    !hasGuideLinks &&
    !hasCards
  ) {
    return null;
  }

  return (
    <section className="mt-10 space-y-8 border-t border-store-background-text/12 pt-8">
      {model.trustBullets.length > 0 ? (
        <section
          aria-labelledby="product-buying-context"
          className="space-y-4 rounded-3xl border border-store-background-text/10 bg-store-background p-5 md:p-6"
        >
          <h2
            id="product-buying-context"
            className="text-lg font-semibold text-store-background-text"
          >
            Buying context
          </h2>
          <ul className="space-y-2 text-sm text-store-background-text/75">
            {model.trustBullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
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

      {hasGuideLinks ? (
        <section className="space-y-4 rounded-3xl border border-store-background-text/10 bg-store-background p-5 md:p-6">
          <h2 className="text-lg font-semibold text-store-background-text">
            Buyer guides and support articles
          </h2>
          <ul className="space-y-4">
            {model.guideLinks.map((link) => (
              <li key={link.href} className="space-y-1">
                <a
                  className="text-sm font-semibold text-store-primary underline-offset-4 hover:underline"
                  href={link.href}
                >
                  {link.title}
                </a>
                <p className="text-sm leading-6 text-store-background-text/70">
                  {link.description}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
