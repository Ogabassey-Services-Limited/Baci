import type { SupabaseClient } from '@supabase/supabase-js';
import { AGENT_COMMERCE_FEED_FRESHNESS } from '@/lib/agent-commerce-feed-freshness';
import { logger } from '@/lib/logger';
import type { AgenticAction } from '@/schemas/agentic-action-health';
import { getAgentCommerceFeedHealthSnapshot } from './agent-commerce-feed-health-snapshot';

export type AgentCommerceFeedHealthStatus = 'attention' | 'monitor' | 'ok';

export type AgentCommerceFeedHealthIssueCode =
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
  supabase?: SupabaseClient;
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

function assertNeverIssueCode(code: never): never {
  throw new Error(`Unexpected feed health issue code: ${code}`);
}

export async function checkAgentCommerceFeedHealth({
  merchantId,
  now = new Date(),
  slug,
  supabase,
}: CheckAgentCommerceFeedHealthInput): Promise<AgentCommerceFeedHealthResult> {
  try {
    const { googleProducts, openAiProducts } =
      await getAgentCommerceFeedHealthSnapshot({
        merchantId,
        supabase,
      });
    const staleProductCount = AGENT_COMMERCE_FEED_FRESHNESS.countStaleProducts({
      now,
      products: openAiProducts,
    });
    const productsMissingTimestamps =
      AGENT_COMMERCE_FEED_FRESHNESS.countProductsMissingTimestamps(
        openAiProducts
      );
    const hasAcceptableFreshnessCoverage =
      AGENT_COMMERCE_FEED_FRESHNESS.hasCurrentProductCoverage({
        staleProducts: staleProductCount,
        totalProducts: openAiProducts.length,
      });
    const issues: AgentCommerceFeedHealthIssue[] = [];

    if (openAiProducts.length === 0 && googleProducts.length === 0) {
      issues.push({
        code: 'feed_empty',
        count: 1,
        message: 'No active products are available in agent catalog feeds.',
        severity: 'monitor',
      });
    }

    if (productsMissingTimestamps > 0 && !hasAcceptableFreshnessCoverage) {
      issues.push({
        code: 'feed_stale',
        count: staleProductCount,
        message:
          'Agent-visible product timestamps include missing or invalid values, and freshness coverage is below the monitoring threshold.',
        severity: 'monitor',
      });
    } else if (productsMissingTimestamps > 0) {
      issues.push({
        code: 'feed_stale',
        count: productsMissingTimestamps,
        message:
          'One or more agent-visible products have missing or invalid feed timestamps.',
        severity: 'monitor',
      });
    } else if (staleProductCount > 0 && !hasAcceptableFreshnessCoverage) {
      issues.push({
        code: 'feed_stale',
        count: staleProductCount,
        message:
          'Agent-visible product freshness coverage is below the monitoring threshold.',
        severity: 'monitor',
      });
    }

    return {
      google_product_count: googleProducts.length,
      issue_count: issues.length,
      issues,
      latest_product_updated_at: getLatestUpdatedAt(openAiProducts),
      openai_product_count: openAiProducts.length,
      // The lightweight cron snapshot intentionally uses one active-product
      // query for both feed surfaces; full feed parity is monitored elsewhere.
      shared_product_count: openAiProducts.length,
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
