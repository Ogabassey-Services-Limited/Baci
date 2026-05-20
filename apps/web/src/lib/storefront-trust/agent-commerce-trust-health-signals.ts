import type { FeedProduct } from '@/app/api/feed/google-merchant/feed-builder';
import type { OpenAIFeedProduct } from '@/app/api/feed/openai/feed-data';
import type { AgentCommerceTrustCheck } from './build-agent-commerce-trust-readiness';
import { getTrustCoverageSeverity } from './get-trust-coverage-severity';
import { isPresentString } from './is-present-string';
import { isValidHttpUrl } from './is-valid-http-url';

const FEED_FRESHNESS_WARN_DAYS = 30;

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

function getReviewSignalSeverity({
  hasVerifiedMerchantReviewAuthority,
  openAiProductsCount,
  productsWithReviewSignals,
}: {
  hasVerifiedMerchantReviewAuthority: boolean;
  openAiProductsCount: number;
  productsWithReviewSignals: number;
}): AgentCommerceTrustCheck['severity'] {
  if (
    hasVerifiedMerchantReviewAuthority &&
    productsWithReviewSignals < openAiProductsCount
  ) {
    return 'warn';
  }

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
    return `${productsWithReviewSignals} of ${openAiProductsCount} agent-visible products have product-level review metadata, but merchant-level Google review authority is connected.`;
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

function countStaleProducts(products: OpenAIFeedProduct[], now: Date): number {
  const cutoff = now.getTime() - FEED_FRESHNESS_WARN_DAYS * 24 * 60 * 60 * 1000;

  return products.filter((product) => {
    const updatedAt = getProductUpdatedAt(product);
    return !updatedAt || updatedAt.getTime() < cutoff;
  }).length;
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
  const latestProductUpdatedAt = getLatestProductUpdatedAt(openAiProducts);
  const staleProducts = countStaleProducts(openAiProducts, now);
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
        affectedProductCount: Math.max(
          0,
          openAiProducts.length - productsWithReviewSignals
        ),
      },
      {
        id: 'feed-freshness',
        label: 'Feed freshness',
        severity:
          openAiProducts.length === 0
            ? 'warn'
            : latestProductUpdatedAt
              ? staleProducts === 0
                ? 'pass'
                : 'warn'
              : 'fail',
        message:
          openAiProducts.length === 0
            ? 'No active products are available for feed freshness checks.'
            : latestProductUpdatedAt
              ? staleProducts === 0
                ? `Latest product feed timestamp is ${latestProductUpdatedAt}.`
                : `${staleProducts} products have stale or missing feed timestamps.`
              : 'No valid product update timestamps were found for feed freshness checks.',
        affectedProductCount: staleProducts,
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
