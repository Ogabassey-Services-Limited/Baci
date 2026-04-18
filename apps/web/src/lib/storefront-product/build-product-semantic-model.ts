import { getProductSemanticSupport } from '@/config/product-semantic-support';
import { CONTENT_CLUSTER_SUPPORT } from '@/config/storefront-content-clusters';
import {
  buildProductSupportLinks,
  type CommercialSupportLink,
} from '@/lib/storefront-compare/build-commercial-support-links';
import { buildProductCompareCandidate } from '@/lib/storefront-compare/compare-eligibility';
import { buildCanonicalProductCompareSlug } from '@/lib/storefront-compare/compare-slugs';
import { getCuratedPriceBands } from '@/lib/storefront-compare/price-band-taxonomy';
import { buildCommercialGuideLinks } from '@/lib/storefront-content/build-commercial-guide-links';
import type { SupportedClusterCategory } from '@/lib/storefront-content/content-cluster-types';
import type {
  BuildProductSemanticModelInput,
  ProductSemanticCandidate,
  ProductSemanticCard,
  ProductSemanticModel,
  ProductSemanticSection,
} from './product-semantic-types';

const priceFormatter = new Intl.NumberFormat('en-NG');

function getSupportCopy(categorySlug: string) {
  return getProductSemanticSupport(categorySlug);
}

function toTitleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function isInStock(product: ProductSemanticCandidate) {
  return product.stock == null || product.stock > 0;
}

function conditionBucketMatches(
  currentProduct: ProductSemanticCandidate,
  candidate: ProductSemanticCandidate
) {
  return (
    (currentProduct.condition ?? '').trim().toLowerCase() ===
    (candidate.condition ?? '').trim().toLowerCase()
  );
}

function countMatchingSpecs(
  currentProduct: ProductSemanticCandidate,
  candidate: ProductSemanticCandidate
) {
  const currentSpecs = currentProduct.product_key_specs ?? {};
  const candidateSpecs = candidate.product_key_specs ?? {};

  return Object.keys(currentSpecs).filter(
    (key) => key in candidateSpecs && currentSpecs[key] === candidateSpecs[key]
  ).length;
}

function buildProductHref(storeUrl: string, product: ProductSemanticCandidate) {
  return product.category_slug
    ? `${storeUrl}/${product.category_slug}/${product.slug}`
    : `${storeUrl}/products/${product.slug}`;
}

function buildCategoryHubLink(
  input: BuildProductSemanticModelInput
): CommercialSupportLink {
  return {
    href: `${input.storeUrl}/${input.categorySlug}`,
    label: `Shop more ${input.categoryName}`,
  };
}

function dedupeLinks(links: CommercialSupportLink[]) {
  const seen = new Set<string>();

  return links.filter((link) => {
    if (seen.has(link.href)) {
      return false;
    }

    seen.add(link.href);
    return true;
  });
}

function buildDirectCompareCta(input: {
  storeUrl: string;
  categorySlug: string;
  currentProduct: ProductSemanticCandidate;
  candidate: ProductSemanticCandidate;
}) {
  const compareCandidate = buildProductCompareCandidate({
    categorySlug: input.categorySlug,
    leftProduct: input.currentProduct,
    rightProduct: input.candidate,
  });

  if (!compareCandidate.isIndexable) {
    return {};
  }

  return {
    secondaryHref: `${input.storeUrl}/${input.categorySlug}/compare/${buildCanonicalProductCompareSlug(input.currentProduct.slug, input.candidate.slug)}`,
    secondaryLabel: `Compare with ${input.candidate.name}`,
  };
}

function buildCardDescription(product: ProductSemanticCandidate) {
  const details = product.condition ? [toTitleCase(product.condition)] : [];
  details.push(`₦${priceFormatter.format(product.price)}`);
  return details.join(' • ');
}

function buildSectionCards(
  input: BuildProductSemanticModelInput,
  products: ProductSemanticCandidate[]
) {
  return products.slice(0, 3).map(
    (product) =>
      ({
        title: product.name,
        description: buildCardDescription(product),
        href: buildProductHref(input.storeUrl, product),
        ...buildDirectCompareCta({
          storeUrl: input.storeUrl,
          categorySlug: input.categorySlug,
          currentProduct: input.currentProduct,
          candidate: product,
        }),
      }) satisfies ProductSemanticCard
  );
}

function buildSection(
  input: BuildProductSemanticModelInput,
  heading: string,
  products: ProductSemanticCandidate[]
): ProductSemanticSection | null {
  const cards = buildSectionCards(input, products);
  return cards.length > 0 ? { heading, cards } : null;
}

function rankAlternatives(currentProduct: ProductSemanticCandidate) {
  return (left: ProductSemanticCandidate, right: ProductSemanticCandidate) =>
    Number(conditionBucketMatches(currentProduct, right)) -
      Number(conditionBucketMatches(currentProduct, left)) ||
    Number(isInStock(right)) - Number(isInStock(left)) ||
    Math.abs(left.price - currentProduct.price) -
      Math.abs(right.price - currentProduct.price) ||
    countMatchingSpecs(currentProduct, right) -
      countMatchingSpecs(currentProduct, left) ||
    left.slug.localeCompare(right.slug);
}

function rankSamePrice(currentProduct: ProductSemanticCandidate) {
  return (left: ProductSemanticCandidate, right: ProductSemanticCandidate) =>
    Number((right.brand ?? '').trim() !== (currentProduct.brand ?? '').trim()) -
      Number(
        (left.brand ?? '').trim() !== (currentProduct.brand ?? '').trim()
      ) ||
    Number(isInStock(right)) - Number(isInStock(left)) ||
    Math.abs(left.price - currentProduct.price) -
      Math.abs(right.price - currentProduct.price) ||
    left.slug.localeCompare(right.slug);
}

function findContainingBand(input: BuildProductSemanticModelInput) {
  return getCuratedPriceBands(input.categorySlug).find(
    (band) =>
      input.currentProduct.price <= band.ceiling &&
      (band.floor ? input.currentProduct.price > band.floor : true)
  );
}

function buildAlternativesSection(input: BuildProductSemanticModelInput) {
  return buildSection(
    input,
    getSupportCopy(input.categorySlug).alternativesHeading,
    input.inventory
      .filter(
        (product) =>
          product.slug !== input.currentProduct.slug &&
          product.category_slug === input.categorySlug
      )
      .sort(rankAlternatives(input.currentProduct))
  );
}

function buildSameBrandSection(input: BuildProductSemanticModelInput) {
  const currentBrand = input.currentProduct.brand?.trim();

  if (!currentBrand) {
    return null;
  }

  return buildSection(
    input,
    getSupportCopy(input.categorySlug).sameBrandHeading,
    input.inventory
      .filter(
        (product) =>
          product.slug !== input.currentProduct.slug &&
          product.category_slug === input.categorySlug &&
          product.brand?.trim() === currentBrand
      )
      .sort(rankAlternatives(input.currentProduct))
  );
}

function buildSamePriceCandidates(input: BuildProductSemanticModelInput) {
  const sameCategoryProducts = input.inventory.filter(
    (product) =>
      product.slug !== input.currentProduct.slug &&
      product.category_slug === input.categorySlug
  );
  const containingBand = findContainingBand(input);
  const sameBandProducts = containingBand
    ? sameCategoryProducts.filter(
        (product) =>
          product.price <= containingBand.ceiling &&
          (containingBand.floor ? product.price > containingBand.floor : true)
      )
    : [];
  const selectedPool =
    sameBandProducts.length > 0
      ? sameBandProducts
      : sameCategoryProducts.filter(
          (product) =>
            Math.abs(product.price - input.currentProduct.price) <=
            input.currentProduct.price * 0.2
        );

  return selectedPool.sort(rankSamePrice(input.currentProduct));
}

function buildSamePriceSection(input: BuildProductSemanticModelInput) {
  return buildSection(
    input,
    getSupportCopy(input.categorySlug).samePriceHeading,
    buildSamePriceCandidates(input)
  );
}

function buildTrustBullets(input: BuildProductSemanticModelInput) {
  const bullets: string[] = [];

  if (input.currentProduct.condition) {
    bullets.push(
      `Available in ${toTitleCase(input.currentProduct.condition)} condition`
    );
  }

  const containingBand = findContainingBand(input);

  if (containingBand) {
    bullets.push(`Listed in ${containingBand.label}`);
  }

  return bullets;
}

export function buildProductSemanticModel(
  input: BuildProductSemanticModelInput
): ProductSemanticModel {
  const currentProductHref = buildProductHref(
    input.storeUrl,
    input.currentProduct
  );
  const supportLinks = dedupeLinks([
    buildCategoryHubLink(input),
    ...buildProductSupportLinks({
      storeUrl: input.storeUrl,
      categorySlug: input.categorySlug,
      currentProductSlug: input.currentProduct.slug,
      currentProductPrice: input.currentProduct.price,
      products: input.inventory,
    }),
  ]).filter((link) => link.href !== currentProductHref);
  const guideLinks =
    input.categorySlug in CONTENT_CLUSTER_SUPPORT
      ? buildCommercialGuideLinks({
          storeUrl: input.storeUrl,
          posts: input.guidePosts ?? [],
          context: {
            pageKind: 'product',
            categorySlug: input.categorySlug as SupportedClusterCategory,
            brands: input.currentProduct.brand
              ? [input.currentProduct.brand]
              : [],
            productSlugs: [input.currentProduct.slug],
          },
        })
      : [];

  return {
    trustBullets: buildTrustBullets(input),
    supportLinks,
    guideLinks,
    alternatives: buildAlternativesSection(input),
    sameBrand: buildSameBrandSection(input),
    samePrice: buildSamePriceSection(input),
  };
}
