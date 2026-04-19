import { CATEGORY_HUB_DEFAULTS } from '@/config/category-hub-defaults';
import { generateSlug } from '@/lib/seo-utils';
import { countBrandsByActiveProduct } from '@/lib/storefront-category/category-hub-brand-utils';
import { buildPriceBandCards } from '@/lib/storefront-category/category-hub-price-band-cards';
import type {
  CategoryHubCard,
  CategoryHubProduct,
} from '@/lib/storefront-category/category-hub-types';
import {
  buildBrandCompareCandidate,
  buildPriceBandCandidate,
} from '@/lib/storefront-compare/compare-eligibility';
import { getCuratedPriceBands } from '@/lib/storefront-compare/price-band-taxonomy';

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function getSpecNumber(
  product: CategoryHubProduct,
  key: string
): number | null {
  const value = product.product_key_specs?.[key];
  return isNumber(value) ? value : null;
}

function pickFirstBrandProduct(
  products: CategoryHubProduct[],
  brand: string
): CategoryHubProduct | null {
  const brandProducts = products
    .filter((product) => product.brand === brand)
    .sort(
      (left, right) =>
        left.price - right.price || left.name.localeCompare(right.name)
    );

  return brandProducts[0] ?? null;
}

function pickRepresentativeProduct(
  products: CategoryHubProduct[],
  comparator: (left: CategoryHubProduct, right: CategoryHubProduct) => number
) {
  return [...products].sort(comparator)[0] ?? null;
}

function buildBestForCards(input: {
  categorySlug: string;
  storeUrl: string;
  products: CategoryHubProduct[];
}) {
  const lowestEligibleBand = getCuratedPriceBands(input.categorySlug)
    .map((band) =>
      buildPriceBandCandidate({
        categorySlug: input.categorySlug,
        band,
        products: input.products,
      })
    )
    .find((candidate) => candidate.isIndexable);

  const makeCard = (
    title: string,
    description: string,
    products: CategoryHubProduct[],
    comparator: (left: CategoryHubProduct, right: CategoryHubProduct) => number
  ): CategoryHubCard | null => {
    const representative = pickRepresentativeProduct(products, comparator);
    if (!representative) {
      return null;
    }

    return {
      title,
      description,
      href: `${input.storeUrl}/${input.categorySlug}/${representative.slug}`,
    };
  };

  if (input.categorySlug === 'smartphones') {
    const priorityDefaults = CATEGORY_HUB_DEFAULTS.smartphones;
    const photography = input.products.filter(
      (product) => (getSpecNumber(product, 'main_camera_mp') ?? 0) >= 48
    );
    const battery = input.products.filter(
      (product) =>
        (getSpecNumber(product, 'battery_mah') ?? 0) >= 5000 ||
        (getSpecNumber(product, 'charging_watt') ?? 0) >= 45
    );
    const budget = lowestEligibleBand?.products ?? [];

    return [
      makeCard(
        priorityDefaults.bestFor.photography.title,
        priorityDefaults.bestFor.photography.description,
        photography,
        (left, right) =>
          (getSpecNumber(right, 'main_camera_mp') ?? 0) -
            (getSpecNumber(left, 'main_camera_mp') ?? 0) ||
          left.price - right.price ||
          left.name.localeCompare(right.name)
      ),
      makeCard(
        priorityDefaults.bestFor.battery.title,
        priorityDefaults.bestFor.battery.description,
        battery,
        (left, right) =>
          (getSpecNumber(right, 'battery_mah') ?? 0) -
            (getSpecNumber(left, 'battery_mah') ?? 0) ||
          (getSpecNumber(right, 'charging_watt') ?? 0) -
            (getSpecNumber(left, 'charging_watt') ?? 0) ||
          left.price - right.price ||
          left.name.localeCompare(right.name)
      ),
      makeCard(
        priorityDefaults.bestFor.budget.title,
        priorityDefaults.bestFor.budget.description,
        budget,
        (left, right) =>
          left.price - right.price || left.name.localeCompare(right.name)
      ),
    ].filter((card): card is CategoryHubCard => Boolean(card));
  }

  if (input.categorySlug === 'laptops') {
    const priorityDefaults = CATEGORY_HUB_DEFAULTS.laptops;
    const workAndSchool = input.products.filter(
      (product) =>
        (getSpecNumber(product, 'ram_gb') ?? 0) >= 8 ||
        (getSpecNumber(product, 'storage_gb') ?? 0) >= 256
    );
    const performance = input.products.filter(
      (product) => (getSpecNumber(product, 'ram_gb') ?? 0) >= 16
    );
    const budget = lowestEligibleBand?.products ?? [];

    return [
      makeCard(
        priorityDefaults.bestFor.workAndSchool.title,
        priorityDefaults.bestFor.workAndSchool.description,
        workAndSchool,
        (left, right) =>
          (getSpecNumber(right, 'ram_gb') ?? 0) -
            (getSpecNumber(left, 'ram_gb') ?? 0) ||
          (getSpecNumber(right, 'storage_gb') ?? 0) -
            (getSpecNumber(left, 'storage_gb') ?? 0) ||
          left.price - right.price ||
          left.name.localeCompare(right.name)
      ),
      makeCard(
        priorityDefaults.bestFor.performance.title,
        priorityDefaults.bestFor.performance.description,
        performance,
        (left, right) =>
          (getSpecNumber(right, 'ram_gb') ?? 0) -
            (getSpecNumber(left, 'ram_gb') ?? 0) ||
          left.price - right.price ||
          left.name.localeCompare(right.name)
      ),
      makeCard(
        priorityDefaults.bestFor.budget.title,
        priorityDefaults.bestFor.budget.description,
        budget,
        (left, right) =>
          left.price - right.price || left.name.localeCompare(right.name)
      ),
    ].filter((card): card is CategoryHubCard => Boolean(card));
  }

  if (input.categorySlug === 'smart-tvs') {
    const priorityDefaults = CATEGORY_HUB_DEFAULTS['smart-tvs'];
    const bigScreen = input.products.filter(
      (product) => (getSpecNumber(product, 'screen_size_inches') ?? 0) >= 55
    );
    const fastMotion = input.products.filter(
      (product) => (getSpecNumber(product, 'refresh_rate_hz') ?? 0) >= 120
    );
    const budget = lowestEligibleBand?.products ?? [];

    return [
      makeCard(
        priorityDefaults.bestFor.bigScreenViewing.title,
        priorityDefaults.bestFor.bigScreenViewing.description,
        bigScreen,
        (left, right) =>
          (getSpecNumber(right, 'screen_size_inches') ?? 0) -
            (getSpecNumber(left, 'screen_size_inches') ?? 0) ||
          left.price - right.price ||
          left.name.localeCompare(right.name)
      ),
      makeCard(
        priorityDefaults.bestFor.fastMotion.title,
        priorityDefaults.bestFor.fastMotion.description,
        fastMotion,
        (left, right) =>
          (getSpecNumber(right, 'refresh_rate_hz') ?? 0) -
            (getSpecNumber(left, 'refresh_rate_hz') ?? 0) ||
          left.price - right.price ||
          left.name.localeCompare(right.name)
      ),
      makeCard(
        priorityDefaults.bestFor.budget.title,
        priorityDefaults.bestFor.budget.description,
        budget,
        (left, right) =>
          left.price - right.price || left.name.localeCompare(right.name)
      ),
    ].filter((card): card is CategoryHubCard => Boolean(card));
  }

  return [];
}

function buildBrandCards(input: {
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

  const sortedBrands = countBrandsByActiveProduct(input.products);
  const canonicalBrandCandidate = buildBrandCompareCandidate({
    categorySlug: input.categorySlug,
    products: input.products,
  });

  return sortedBrands.slice(0, 3).flatMap((entry) => {
    const representative = pickFirstBrandProduct(input.products, entry.label);
    if (!representative) {
      return [];
    }

    const card: CategoryHubCard = {
      title: entry.label,
      description: `${entry.count} active ${entry.count === 1 ? 'product' : 'products'} in this category.`,
      href: `${input.storeUrl}/${input.categorySlug}/${representative.slug}`,
      eyebrow: priorityDefaults.brandHighlights.heading,
    };

    if (
      canonicalBrandCandidate?.isIndexable &&
      [canonicalBrandCandidate.leftBrand, canonicalBrandCandidate.rightBrand]
        .map((brand) => generateSlug(brand))
        .includes(generateSlug(entry.label))
    ) {
      card.secondaryHref = `${input.storeUrl}/${input.categorySlug}/compare/${canonicalBrandCandidate.canonicalSlug}`;
      card.secondaryLabel = `Compare ${canonicalBrandCandidate.leftBrand} vs ${canonicalBrandCandidate.rightBrand}`;
    }

    return [card];
  });
}

export function buildCategoryHubCards(input: {
  categorySlug: string;
  storeUrl: string;
  products: CategoryHubProduct[];
}) {
  return {
    bestForCards: buildBestForCards(input),
    brandCards: buildBrandCards(input),
    priceBandCards: buildPriceBandCards(input),
  };
}
