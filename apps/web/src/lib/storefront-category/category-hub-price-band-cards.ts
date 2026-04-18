import { CATEGORY_HUB_DEFAULTS } from '@/config/category-hub-defaults';
import type {
  CategoryHubCard,
  CategoryHubProduct,
} from '@/lib/storefront-category/category-hub-types';
import { buildPriceBandCandidate } from '@/lib/storefront-compare/compare-eligibility';
import { getCuratedPriceBands } from '@/lib/storefront-compare/price-band-taxonomy';

export function buildPriceBandCards(input: {
  categorySlug: string;
  storeUrl: string;
  products: CategoryHubProduct[];
}) {
  const priorityDefaults =
    CATEGORY_HUB_DEFAULTS[
      input.categorySlug as keyof typeof CATEGORY_HUB_DEFAULTS
    ];
  if (!priorityDefaults) {
    return [];
  }

  return getCuratedPriceBands(input.categorySlug)
    .map((band, index) => ({
      band,
      copy: priorityDefaults.priceBands[index],
    }))
    .map(({ band, copy }) => {
      if (!copy) {
        return null;
      }

      const candidate = buildPriceBandCandidate({
        categorySlug: input.categorySlug,
        band,
        products: input.products,
      });

      if (!candidate.isIndexable) {
        return null;
      }

      return {
        title: copy.title,
        description: copy.description,
        href: `${input.storeUrl}/${input.categorySlug}/best-under/${band.slug}`,
      } satisfies CategoryHubCard;
    })
    .filter((card): card is CategoryHubCard => Boolean(card))
    .slice(0, 3);
}
