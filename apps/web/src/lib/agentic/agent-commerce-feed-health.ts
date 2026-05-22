import { getCachedGoogleMerchantFeedData } from '@/app/api/feed/google-merchant/feed-data';
import { getCachedOpenAIFeedData } from '@/app/api/feed/openai/feed-data';
import { logger } from '@/lib/logger';
import type { AgenticAction } from '@/schemas/agentic-action-health';

const FEED_FRESHNESS_MONITOR_DAYS = 30;

export type AgentCommerceFeedHealthStatus = 'attention' | 'monitor' | 'ok';

export type AgentCommerceFeedHealthIssueCode =
  | 'feed_catalog_drift'
  | 'feed_empty'
  | 'feed_generation_failed'
  | 'feed_stale';

export interface AgentCommerceFeedHealthIssue {
  code: AgentCommerceFeedHealthIssueCode;
  count: number;
  message: string;
  severity: Exclude<AgenticAction['severity'], 'ok'>;
}

export interface AgentCommerceFeedHealthResult {
  google_product_count: number | null;
  issue_count: number;
  issues: AgentCommerceFeedHealthIssue[];
  latest_product_updated_at: string | null;
  openai_product_count: number | null;
  shared_product_count: number | null;
  stale_product_count: number | null;
  status: AgentCommerceFeedHealthStatus;
}

interface CheckAgentCommerceFeedHealthInput {
  merchantId: string;
  now?: Date;
  slug: string;
}

function getStatus(
  issues: AgentCommerceFeedHealthIssue[]
): AgentCommerceFeedHealthStatus {
  if (issues.some((issue) => issue.severity === 'attention')) {
    return 'attention';
  }

  if (issues.some((issue) => issue.severity === 'monitor')) {
    return 'monitor';
  }

  return 'ok';
}

function getLatestUpdatedAt(
  products: Array<{ updated_at?: string | null }>
): string | null {
  const latest = products
    .map((product) => {
      if (!product.updated_at) return null;
      const parsed = Date.parse(product.updated_at);
      return Number.isFinite(parsed) ? new Date(parsed) : null;
    })
    .filter((value): value is Date => Boolean(value))
    .sort((left, right) => right.getTime() - left.getTime())[0];

  return latest?.toISOString() ?? null;
}

function countStaleProducts({
  now,
  products,
}: {
  now: Date;
  products: Array<{ updated_at?: string | null }>;
}) {
  const cutoff =
    now.getTime() - FEED_FRESHNESS_MONITOR_DAYS * 24 * 60 * 60 * 1000;

  return products.filter((product) => {
    if (!product.updated_at) return true;
    const updatedAt = Date.parse(product.updated_at);
    return !Number.isFinite(updatedAt) || updatedAt < cutoff;
  }).length;
}

function countCatalogDrift({
  googleProductIds,
  openAiProductIds,
}: {
  googleProductIds: Set<string>;
  openAiProductIds: Set<string>;
}) {
  let driftCount = 0;

  for (const productId of openAiProductIds) {
    if (!googleProductIds.has(productId)) driftCount += 1;
  }

  for (const productId of googleProductIds) {
    if (!openAiProductIds.has(productId)) driftCount += 1;
  }

  return driftCount;
}

function countSharedProducts({
  googleProductIds,
  openAiProductIds,
}: {
  googleProductIds: Set<string>;
  openAiProductIds: Set<string>;
}) {
  let sharedCount = 0;

  for (const productId of openAiProductIds) {
    if (googleProductIds.has(productId)) sharedCount += 1;
  }

  return sharedCount;
}

function assertNeverIssueCode(code: never): never {
  throw new Error(`Unexpected feed health issue code: ${code}`);
}

export async function checkAgentCommerceFeedHealth({
  merchantId,
  now = new Date(),
  slug,
}: CheckAgentCommerceFeedHealthInput): Promise<AgentCommerceFeedHealthResult> {
  try {
    const [openAiFeedData, googleFeedData] = await Promise.all([
      getCachedOpenAIFeedData(merchantId),
      getCachedGoogleMerchantFeedData(merchantId, slug),
    ]);
    const openAiProductIds = new Set(
      openAiFeedData.products.map((product) => product.id)
    );
    const googleProductIds = new Set(
      googleFeedData.products.map((product) => product.id)
    );
    const catalogDriftCount = countCatalogDrift({
      googleProductIds,
      openAiProductIds,
    });
    const staleProductCount = countStaleProducts({
      now,
      products: openAiFeedData.products,
    });
    const issues: AgentCommerceFeedHealthIssue[] = [];

    if (catalogDriftCount > 0) {
      issues.push({
        code: 'feed_catalog_drift',
        count: catalogDriftCount,
        message:
          'OpenAI and Google Merchant feeds expose different active product sets.',
        severity: 'attention',
      });
    }

    if (
      openAiFeedData.products.length === 0 &&
      googleFeedData.products.length === 0
    ) {
      issues.push({
        code: 'feed_empty',
        count: 1,
        message: 'No active products are available in agent catalog feeds.',
        severity: 'monitor',
      });
    }

    if (staleProductCount > 0) {
      issues.push({
        code: 'feed_stale',
        count: staleProductCount,
        message:
          'One or more agent-visible products have stale or missing feed timestamps.',
        severity: 'monitor',
      });
    }

    return {
      google_product_count: googleFeedData.products.length,
      issue_count: issues.length,
      issues,
      latest_product_updated_at: getLatestUpdatedAt(openAiFeedData.products),
      openai_product_count: openAiFeedData.products.length,
      shared_product_count: countSharedProducts({
        googleProductIds,
        openAiProductIds,
      }),
      stale_product_count: staleProductCount,
      status: getStatus(issues),
    };
  } catch (error) {
    logger.warn({
      message: 'Agent commerce feed health check failed',
      error,
      merchantId,
      slug,
    });

    const issues: AgentCommerceFeedHealthIssue[] = [
      {
        code: 'feed_generation_failed',
        count: 1,
        message:
          'Agent catalog feeds could not be generated for health monitoring.',
        severity: 'attention',
      },
    ];

    return {
      google_product_count: null,
      issue_count: issues.length,
      issues,
      latest_product_updated_at: null,
      openai_product_count: null,
      shared_product_count: null,
      stale_product_count: null,
      status: 'attention',
    };
  }
}

export function buildAgentCommerceFeedHealthActions(
  feeds: AgentCommerceFeedHealthResult
): AgenticAction[] {
  return feeds.issues.map((issue): AgenticAction => {
    switch (issue.code) {
      case 'feed_catalog_drift':
        return {
          code: 'AGENTIC_FEED_CATALOG_DRIFT',
          count: issue.count,
          message: issue.message,
          next_step:
            'Compare OpenAI and Google Merchant feed product IDs, then refresh or publish any missing products.',
          next_step_url: '/dashboard/products',
          severity: issue.severity,
        };
      case 'feed_empty':
        return {
          code: 'AGENTIC_FEED_EMPTY',
          count: issue.count,
          message: issue.message,
          next_step:
            'Publish at least one active product before expanding agent traffic.',
          next_step_url: '/dashboard/products',
          severity: issue.severity,
        };
      case 'feed_generation_failed':
        return {
          code: 'AGENTIC_FEED_GENERATION_FAILED',
          count: issue.count,
          message: issue.message,
          next_step:
            'Open Products and verify product, variant, and image-manifest data is healthy.',
          next_step_url: '/dashboard/products',
          severity: issue.severity,
        };
      case 'feed_stale':
        return {
          code: 'AGENTIC_FEED_STALE_PRODUCTS',
          count: issue.count,
          message: issue.message,
          next_step:
            'Refresh stale catalog items so agent feed timestamps reflect current inventory.',
          next_step_url: '/dashboard/products',
          severity: issue.severity,
        };
      default:
        return assertNeverIssueCode(issue.code);
    }
  });
}

export function getAgentCommerceFeedStatusReason(
  feeds: AgentCommerceFeedHealthResult,
  fallbackReason: string
) {
  const attentionIssue = feeds.issues.find(
    (issue) => issue.severity === 'attention'
  );
  if (!attentionIssue) return fallbackReason;

  return `agent_commerce_${attentionIssue.code}`;
}
