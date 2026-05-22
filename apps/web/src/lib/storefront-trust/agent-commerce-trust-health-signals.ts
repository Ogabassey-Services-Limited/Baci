import type { FeedProduct } from '@/app/api/feed/google-merchant/feed-builder';
import type { OpenAIFeedProduct } from '@/app/api/feed/openai/feed-data';
import { AGENT_COMMERCE_FEED_FRESHNESS } from '@/lib/agent-commerce-feed-freshness';
import type { AgentCommerceTrustCheck } from './build-agent-commerce-trust-readiness';
import { getTrustCoverageSeverity } from './get-trust-coverage-severity';
import { isPresentString } from './is-present-string';
import { isValidHttpUrl } from './is-valid-http-url';

interface AgentCommerceCrawlerSurfaces {
  llms: string;
  robots: string;
  sitemap: string;
}

interface BuildAgentCommerceTrustHealthSignalsInput {
  hasVerifiedMerchantReviewAuthority?: boolean;
  now?: Date;
  openAiProducts: OpenAIFeedProduct[];
  surfaces: AgentCommerceCrawlerSurfaces;
}

interface AgentCommerceTrustHealthSignals {
  checks: AgentCommerceTrustCheck[];
  totals: {
    latestProductUpdatedAt: string | null;
    productsWithStructuredData: number;
    staleProducts: number;
  };
}

function hasStructuredDataFields(product: OpenAIFeedProduct): boolean {
  const price = Number(product.price);
  const hasIdentifier = [
    product.brand,
    product.gtin,
    product.mpn,
    product.sku,
    product.category,
  ].some(isPresentString);

  return (
    isPresentString(product.name) &&
    isPresentString(product.description) &&
    Number.isFinite(price) &&
    price >= 0 &&
    hasIdentifier
  );
}

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim().length === 0) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasReviewSignalFields(product: OpenAIFeedProduct): boolean {
  const reviewCount = toFiniteNumber(product.review_count);
  if (reviewCount === null || reviewCount <= 0) return false;

  const averageRating = toFiniteNumber(product.average_rating);
  if (averageRating === null) return false;

  return averageRating >= 0 && averageRating <= 5;
}

function formatProductCount(count: number): string {
  return `${count} ${count === 1 ? 'product' : 'products'}`;
}

function getReviewSignalSeverity({
  hasVerifiedMerchantReviewAuthority,
  openAiProductsCount,
  productsWithReviewSignals,
}: {
  hasVerifiedMerchantReviewAuthority: boolean;
  openAiProductsCount: number;
  productsWithReviewSignals: number;
}): AgentCommerceTrustCheck['severity'] {
  if (openAiProductsCount === 0) return 'warn';

  if (hasVerifiedMerchantReviewAuthority) return 'pass';

  return getTrustCoverageSeverity(
    productsWithReviewSignals,
    openAiProductsCount
  );
}

function getReviewSignalMessage({
  hasVerifiedMerchantReviewAuthority,
  openAiProductsCount,
  productsWithReviewSignals,
}: {
  hasVerifiedMerchantReviewAuthority: boolean;
  openAiProductsCount: number;
  productsWithReviewSignals: number;
}): string {
  if (openAiProductsCount === 0) {
    return 'No active products are available for review signal auditing.';
  }

  if (
    hasVerifiedMerchantReviewAuthority &&
    productsWithReviewSignals < openAiProductsCount
  ) {
    return `${productsWithReviewSignals} of ${openAiProductsCount} agent-visible products have product-level review metadata; verified merchant-level Google review authority satisfies review trust for this catalog.`;
  }

  return `${productsWithReviewSignals} of ${openAiProductsCount} agent-visible products have usable review count and rating metadata.`;
}

function getProductUpdatedAt(
  product: Pick<FeedProduct, 'updated_at'>
): Date | null {
  if (!product.updated_at) return null;

  const parsed = new Date(product.updated_at);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getLatestProductUpdatedAt(
  products: OpenAIFeedProduct[]
): string | null {
  const latest = products
    .map(getProductUpdatedAt)
    .filter((value): value is Date => Boolean(value))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return latest?.toISOString() ?? null;
}

export function buildAgentCommerceTrustHealthSignals({
  hasVerifiedMerchantReviewAuthority = false,
  now = new Date(),
  openAiProducts,
  surfaces,
}: BuildAgentCommerceTrustHealthSignalsInput): AgentCommerceTrustHealthSignals {
  const productsWithStructuredData = openAiProducts.filter(
    hasStructuredDataFields
  ).length;
  const productsWithReviewSignals = openAiProducts.filter(
    hasReviewSignalFields
  ).length;
  const productsMissingReviewSignals = Math.max(
    0,
    openAiProducts.length - productsWithReviewSignals
  );
  const latestProductUpdatedAt = getLatestProductUpdatedAt(openAiProducts);
  const staleProducts = AGENT_COMMERCE_FEED_FRESHNESS.countStaleProducts({
    now,
    products: openAiProducts,
  });
  const productsMissingTimestamps =
    AGENT_COMMERCE_FEED_FRESHNESS.countProductsMissingTimestamps(
      openAiProducts
    );
  const hasAcceptableFreshnessCoverage =
    AGENT_COMMERCE_FEED_FRESHNESS.hasCurrentProductCoverage({
      staleProducts,
      totalProducts: openAiProducts.length,
    });
  const crawlerUrls = [surfaces.robots, surfaces.sitemap, surfaces.llms];
  const validCrawlerUrls = crawlerUrls.filter(isValidHttpUrl).length;

  return {
    checks: [
      {
        id: 'structured-data-readiness',
        label: 'Structured data readiness',
        severity: getTrustCoverageSeverity(
          productsWithStructuredData,
          openAiProducts.length
        ),
        message:
          openAiProducts.length === 0
            ? 'No active products are available for JSON-LD field auditing.'
            : `${productsWithStructuredData} of ${openAiProducts.length} agent-visible products have core JSON-LD product fields.`,
        affectedProductCount: Math.max(
          0,
          openAiProducts.length - productsWithStructuredData
        ),
      },
      {
        id: 'review-signal-coverage',
        label: 'Review signal coverage',
        severity: getReviewSignalSeverity({
          hasVerifiedMerchantReviewAuthority,
          openAiProductsCount: openAiProducts.length,
          productsWithReviewSignals,
        }),
        message: getReviewSignalMessage({
          hasVerifiedMerchantReviewAuthority,
          openAiProductsCount: openAiProducts.length,
          productsWithReviewSignals,
        }),
        affectedProductCount: hasVerifiedMerchantReviewAuthority
          ? 0
          : productsMissingReviewSignals,
      },
      {
        id: 'feed-freshness',
        label: 'Feed freshness',
        severity:
          openAiProducts.length === 0
            ? 'warn'
            : latestProductUpdatedAt
              ? productsMissingTimestamps === 0 &&
                hasAcceptableFreshnessCoverage
                ? 'pass'
                : 'warn'
              : 'fail',
        message:
          openAiProducts.length === 0
            ? 'No active products are available for feed freshness checks.'
            : latestProductUpdatedAt
              ? productsMissingTimestamps > 0 && !hasAcceptableFreshnessCoverage
                ? `Product timestamps are missing or invalid for ${formatProductCount(productsMissingTimestamps)}, and ${formatProductCount(staleProducts)} are outside the freshness window.`
                : productsMissingTimestamps > 0
                  ? `Product timestamps are missing or invalid for ${formatProductCount(productsMissingTimestamps)}.`
                  : hasAcceptableFreshnessCoverage
                    ? `Latest product feed timestamp is ${latestProductUpdatedAt}.`
                    : `Product timestamps are outside the freshness window for ${formatProductCount(staleProducts)}.`
              : 'No valid product update timestamps were found for feed freshness checks.',
        affectedProductCount:
          productsMissingTimestamps > 0 && hasAcceptableFreshnessCoverage
            ? productsMissingTimestamps
            : hasAcceptableFreshnessCoverage
              ? 0
              : staleProducts,
      },
      {
        id: 'crawler-visibility',
        label: 'Crawler visibility',
        severity: validCrawlerUrls === crawlerUrls.length ? 'pass' : 'fail',
        message:
          validCrawlerUrls === crawlerUrls.length
            ? 'Robots, sitemap, and llms entry points are published for agent and search crawlers.'
            : 'Robots, sitemap, or llms entry point URLs are malformed.',
      },
    ],
    totals: {
      latestProductUpdatedAt,
      productsWithStructuredData,
      staleProducts,
    },
  };
}
