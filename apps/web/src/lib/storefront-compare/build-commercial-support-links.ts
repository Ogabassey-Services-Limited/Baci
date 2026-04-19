import { generateSlug } from '../seo-utils';
import {
  buildBrandCompareCandidate,
  buildPriceBandCandidate,
  buildProductCompareCandidate,
} from './compare-eligibility';
import {
  buildCanonicalBrandCompareSlug,
  buildCanonicalProductCompareSlug,
} from './compare-slugs';
import { getCuratedPriceBands } from './price-band-taxonomy';

export interface CommercialSupportLink {
  href: string;
  label: string;
}

interface CommercialSupportProduct {
  slug: string;
  name: string;
  brand?: string | null;
  price: number;
  category_slug?: string | null;
  product_key_specs?: Record<string, unknown> | null;
}

function findFirstEligibleProductCompare(
  categorySlug: string,
  products: CommercialSupportProduct[]
) {
  for (let leftIndex = 0; leftIndex < products.length - 1; leftIndex += 1) {
    const leftProduct = products[leftIndex];

    for (
      let rightIndex = leftIndex + 1;
      rightIndex < products.length;
      rightIndex += 1
    ) {
      const rightProduct = products[rightIndex];
      const candidate = buildProductCompareCandidate({
        categorySlug,
        leftProduct,
        rightProduct,
      });

      if (candidate.isIndexable) {
        return {
          leftProduct,
          rightProduct,
        };
      }
    }
  }

  return null;
}

function buildFirstEligiblePriceBandLink(input: {
  storeUrl: string;
  categorySlug: string;
  products: CommercialSupportProduct[];
}) {
  const candidate = getCuratedPriceBands(input.categorySlug)
    .map((band) =>
      buildPriceBandCandidate({
        categorySlug: input.categorySlug,
        band,
        products: input.products,
      })
    )
    .find((entry) => entry.isIndexable);

  if (!candidate) {
    return null;
  }

  return {
    href: `${input.storeUrl}/${input.categorySlug}/best-under/${candidate.band.slug}`,
    label: candidate.band.label,
  } satisfies CommercialSupportLink;
}

export function buildCategorySupportLinks(input: {
  storeUrl: string;
  categorySlug: string;
  categoryName: string;
  products: CommercialSupportProduct[];
}): CommercialSupportLink[] {
  const links: CommercialSupportLink[] = [];
  const firstEligibleProductCompare = findFirstEligibleProductCompare(
    input.categorySlug,
    input.products
  );

  if (firstEligibleProductCompare) {
    links.push({
      href: `${input.storeUrl}/${input.categorySlug}/compare/${buildCanonicalProductCompareSlug(firstEligibleProductCompare.leftProduct.slug, firstEligibleProductCompare.rightProduct.slug)}`,
      label: `${firstEligibleProductCompare.leftProduct.name} vs ${firstEligibleProductCompare.rightProduct.name}`,
    });
  }

  const brandCandidate = buildBrandCompareCandidate({
    categorySlug: input.categorySlug,
    products: input.products,
  });

  if (brandCandidate?.isIndexable) {
    links.push({
      href: `${input.storeUrl}/${input.categorySlug}/compare/${buildCanonicalBrandCompareSlug(brandCandidate.leftBrand, brandCandidate.rightBrand)}`,
      label: `${brandCandidate.leftBrand} vs ${brandCandidate.rightBrand}`,
    });
  }

  const priceBandLink = buildFirstEligiblePriceBandLink({
    storeUrl: input.storeUrl,
    categorySlug: input.categorySlug,
    products: input.products,
  });

  if (priceBandLink) {
    links.push(priceBandLink);
  }

  return links;
}

export function buildProductSupportLinks(input: {
  storeUrl: string;
  categorySlug: string;
  currentProductSlug: string;
  currentProductPrice: number;
  products: CommercialSupportProduct[];
}): CommercialSupportLink[] {
  const links: CommercialSupportLink[] = [];
  const currentProduct = input.products.find(
    (product) => product.slug === input.currentProductSlug
  );

  if (!currentProduct) {
    return links;
  }

  const productCompareEntry = input.products
    .filter((product) => product.slug !== input.currentProductSlug)
    .map((alternate) => ({
      alternate,
      candidate: buildProductCompareCandidate({
        categorySlug: input.categorySlug,
        leftProduct: currentProduct,
        rightProduct: alternate,
      }),
    }))
    .find((entry) => entry.candidate.isIndexable);

  if (productCompareEntry) {
    links.push({
      href: `${input.storeUrl}/${input.categorySlug}/compare/${buildCanonicalProductCompareSlug(currentProduct.slug, productCompareEntry.alternate.slug)}`,
      label: `Compare with ${productCompareEntry.alternate.name}`,
    });
  }

  const brandCandidate = buildBrandCompareCandidate({
    categorySlug: input.categorySlug,
    products: input.products,
  });
  const currentBrandKey = generateSlug(currentProduct.brand || '');

  if (
    brandCandidate?.isIndexable &&
    currentBrandKey &&
    [brandCandidate.leftBrand, brandCandidate.rightBrand]
      .map((brand) => generateSlug(brand))
      .includes(currentBrandKey)
  ) {
    links.push({
      href: `${input.storeUrl}/${input.categorySlug}/compare/${buildCanonicalBrandCompareSlug(brandCandidate.leftBrand, brandCandidate.rightBrand)}`,
      label: `${brandCandidate.leftBrand} vs ${brandCandidate.rightBrand}`,
    });
  }

  const priceBandCandidate = getCuratedPriceBands(input.categorySlug)
    .map((band) =>
      buildPriceBandCandidate({
        categorySlug: input.categorySlug,
        band,
        products: input.products,
      })
    )
    .find(
      (candidate) =>
        candidate.isIndexable &&
        input.currentProductPrice <= candidate.band.ceiling &&
        (candidate.band.floor
          ? input.currentProductPrice > candidate.band.floor
          : true)
    );

  if (priceBandCandidate) {
    links.push({
      href: `${input.storeUrl}/${input.categorySlug}/best-under/${priceBandCandidate.band.slug}`,
      label: priceBandCandidate.band.label,
    });
  }

  return links;
}
