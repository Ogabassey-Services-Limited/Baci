import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getCachedGoogleMerchantFeedData } from '@/app/api/feed/google-merchant/feed-data';
import { getCachedOpenAIFeedData } from '@/app/api/feed/openai/feed-data';
import type { StaffAccess } from '@/hooks/merchant';
import { loadAgenticActionHealth } from '@/lib/agentic/action-health-loader';
import {
  type CrawlerLogSummary,
  type CrawlerLogSummaryRow,
  createCrawlerLogSummaryAccumulator,
} from '@/lib/agentic/crawler-observability';
import { getMerchantForUser } from '@/lib/merchant-server';
import { sanitizeErrorMessage } from '@/lib/sanitize-error-message';
import { buildStoreUrl } from '@/lib/store-url';
import {
  type AgentCommerceTrustReadinessSummary,
  buildAgentCommerceTrustReadiness,
  summarizeAgentCommerceTrustReadiness,
} from '@/lib/storefront-trust/build-agent-commerce-trust-readiness';
import { buildMerchantTrustProfile } from '@/lib/storefront-trust/build-merchant-trust-profile';
import { enrichMerchantReviewAuthority } from '@/lib/storefront-trust/enrich-merchant-review-authority';
import type { MerchantTrustProfileSource } from '@/lib/storefront-trust/merchant-trust-profile-types';
import { createClient } from '@/lib/supabase/server';
import type { AgenticActionHealthPayload } from '@/schemas/agentic-action-health';

export type AgenticCenterState = 'ready' | 'error' | 'unauthorized';

export interface AgenticCentersData {
  actionCenterState: AgenticCenterState;
  actionHealth: AgenticActionHealthPayload | null;
  crawlerCenterState: AgenticCenterState;
  crawlerSummary: CrawlerLogSummary | null;
  isPublished: boolean;
  trustCenterState: AgenticCenterState;
  trustReadiness: AgentCommerceTrustReadinessSummary | null;
}

const CRAWLER_VISIBILITY_WINDOW_DAYS = 14;
const CRAWLER_LOG_PAGE_SIZE = 1000;
const CRAWLER_LOG_MAX_PAGES = 10;
const CRAWLER_RECENT_ACTIVITY_LIMIT = 3;
const CRAWLER_LOG_SELECT_COLUMNS =
  'id, agent_family, bot_name, cache_outcome, crawled_at, host, response_time_ms, status_code, url_path, user_agent';

type CrawlerLogQueryRow = CrawlerLogSummaryRow & { id: string };

interface CrawlerLogCursor {
  crawledAt: string;
  id: string;
}

function isPermissionDeniedError(reason: unknown): boolean {
  if (!reason || typeof reason !== 'object') return false;

  const errorRecord = reason as Record<string, unknown>;
  if (errorRecord.code === '42501') return true;

  const message = errorRecord.message;
  return (
    typeof message === 'string' &&
    message.toLowerCase().includes('permission denied')
  );
}

function canViewAgenticCenters(staffAccess: StaffAccess): boolean {
  if (staffAccess.isOwner) return true;
  if (!staffAccess.isStaff) return false;
  return staffAccess.permissions.integrations?.view === true;
}

function canViewCrawlerVisibility(staffAccess: StaffAccess): boolean {
  if (staffAccess.isOwner) return true;
  if (!staffAccess.isStaff) return false;
  return staffAccess.permissions.analytics?.view === true;
}

function toCrawlerLogSummaryRow(row: CrawlerLogQueryRow): CrawlerLogSummaryRow {
  return {
    agent_family: row.agent_family,
    bot_name: row.bot_name,
    cache_outcome: row.cache_outcome,
    crawled_at: row.crawled_at,
    host: row.host,
    response_time_ms: row.response_time_ms,
    status_code: row.status_code,
    url_path: row.url_path,
    user_agent: row.user_agent,
  };
}

function buildCrawlerLogCursorFilter(cursor: CrawlerLogCursor) {
  return `crawled_at.lt.${cursor.crawledAt},and(crawled_at.eq.${cursor.crawledAt},id.lt.${cursor.id})`;
}

async function hasCrawlerRowsAfterCursor({
  crawledSince,
  crawledUntil,
  cursor,
  merchantId,
  supabase,
}: {
  crawledSince: string;
  crawledUntil: string;
  cursor: CrawlerLogCursor;
  merchantId: string;
  supabase: SupabaseClient;
}): Promise<boolean> {
  const { data, error } = await supabase
    .from('crawler_logs')
    .select('id')
    .eq('merchant_id', merchantId)
    .gte('crawled_at', crawledSince)
    .lte('crawled_at', crawledUntil)
    .order('crawled_at', { ascending: false })
    .order('id', { ascending: false })
    .or(buildCrawlerLogCursorFilter(cursor))
    .limit(1);

  if (error) throw error;

  return (data ?? []).length > 0;
}

async function loadAgenticTrustReadiness(
  merchant: {
    business_name: string;
    custom_domain?: string | null;
    id: string;
    slug?: string | null;
  } & MerchantTrustProfileSource
) {
  const slug = merchant.slug ?? merchant.id;
  const baseUrl = buildStoreUrl({
    slug,
    custom_domain: merchant.custom_domain ?? undefined,
  });
  const trustProfile = await enrichMerchantReviewAuthority(
    buildMerchantTrustProfile(merchant, baseUrl)
  );
  const [openAiFeedData, googleFeedData] = await Promise.all([
    getCachedOpenAIFeedData(merchant.id, true),
    getCachedGoogleMerchantFeedData(merchant.id, slug),
  ]);

  // Project to the aggregate-only summary before it crosses the
  // server/client boundary. The full readiness payload includes per-check
  // `affectedProductIds` arrays that can hold thousands of IDs for large
  // catalogs; the dashboard card only renders counts/status/severity.
  return summarizeAgentCommerceTrustReadiness(
    buildAgentCommerceTrustReadiness({
      baseUrl,
      googleFeedData,
      merchant: {
        business_name: merchant.business_name,
        slug,
      },
      openAiFeedData,
      trustProfile,
    })
  );
}

async function loadAgenticCrawlerVisibility(
  supabase: SupabaseClient,
  merchantId: string
): Promise<CrawlerLogSummary> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - CRAWLER_VISIBILITY_WINDOW_DAYS);
  const crawledSince = startDate.toISOString();
  const crawledUntil = new Date().toISOString();
  const accumulator = createCrawlerLogSummaryAccumulator(
    CRAWLER_VISIBILITY_WINDOW_DAYS,
    { recentLimit: CRAWLER_RECENT_ACTIVITY_LIMIT }
  );
  let cursor: CrawlerLogCursor | null = null;
  let isPartial = false;

  for (let page = 0; page < CRAWLER_LOG_MAX_PAGES; page += 1) {
    const query = supabase
      .from('crawler_logs')
      .select(CRAWLER_LOG_SELECT_COLUMNS)
      .eq('merchant_id', merchantId)
      .gte('crawled_at', crawledSince)
      .lte('crawled_at', crawledUntil)
      .order('crawled_at', { ascending: false })
      .order('id', { ascending: false });

    const pagedQuery = cursor
      ? query.or(buildCrawlerLogCursorFilter(cursor))
      : query;
    const { data, error } = await pagedQuery.limit(CRAWLER_LOG_PAGE_SIZE);

    if (error) throw error;

    const pageRows = (data ?? []) as CrawlerLogQueryRow[];
    accumulator.addRows(pageRows.map(toCrawlerLogSummaryRow));

    if (pageRows.length < CRAWLER_LOG_PAGE_SIZE) {
      break;
    }

    const lastRow = pageRows.at(-1);
    if (!lastRow) {
      break;
    }

    cursor = { crawledAt: lastRow.crawled_at, id: lastRow.id };
    if (page === CRAWLER_LOG_MAX_PAGES - 1) {
      isPartial = await hasCrawlerRowsAfterCursor({
        crawledSince,
        crawledUntil,
        cursor,
        merchantId,
        supabase,
      });
    }
  }

  return { ...accumulator.toSummary(), isPartial };
}

export async function loadAgenticCentersData(): Promise<AgenticCentersData> {
  const { merchant, staffAccess } = await getMerchantForUser();
  const canViewAgentic = canViewAgenticCenters(staffAccess);
  const canViewCrawler = canViewCrawlerVisibility(staffAccess);

  if (!merchant || (!canViewAgentic && !canViewCrawler)) {
    return {
      actionCenterState: 'unauthorized',
      actionHealth: null,
      crawlerCenterState: 'unauthorized',
      crawlerSummary: null,
      isPublished: Boolean(merchant?.is_published),
      trustCenterState: 'unauthorized',
      trustReadiness: null,
    };
  }

  const isPublished = Boolean(merchant.is_published);
  if (!isPublished) {
    return {
      actionCenterState: canViewAgentic ? 'ready' : 'unauthorized',
      actionHealth: null,
      crawlerCenterState: canViewCrawler ? 'ready' : 'unauthorized',
      crawlerSummary: null,
      isPublished,
      trustCenterState: canViewAgentic ? 'ready' : 'unauthorized',
      trustReadiness: null,
    };
  }

  const supabase = await createClient();
  const [actionHealthResult, trustReadinessResult, crawlerResult] =
    await Promise.allSettled([
      canViewAgentic ? loadAgenticActionHealth(supabase, merchant.id) : null,
      canViewAgentic ? loadAgenticTrustReadiness(merchant) : null,
      canViewCrawler
        ? loadAgenticCrawlerVisibility(supabase, merchant.id)
        : null,
    ]);

  if (
    canViewAgentic &&
    actionHealthResult.status === 'rejected' &&
    !isPermissionDeniedError(actionHealthResult.reason)
  ) {
    console.error(
      'Failed to fetch action health:',
      sanitizeErrorMessage(actionHealthResult.reason)
    );
  }

  if (canViewAgentic && trustReadinessResult.status === 'rejected') {
    console.error(
      'Failed to fetch trust readiness:',
      sanitizeErrorMessage(trustReadinessResult.reason)
    );
  }

  if (
    canViewCrawler &&
    crawlerResult.status === 'rejected' &&
    !isPermissionDeniedError(crawlerResult.reason)
  ) {
    console.error(
      'Failed to fetch crawler visibility:',
      sanitizeErrorMessage(crawlerResult.reason)
    );
  }

  const actionHealth =
    actionHealthResult.status === 'fulfilled' && canViewAgentic
      ? actionHealthResult.value
      : null;
  const trustReadiness =
    trustReadinessResult.status === 'fulfilled' && canViewAgentic
      ? trustReadinessResult.value
      : null;
  const crawlerSummary =
    crawlerResult.status === 'fulfilled' && canViewCrawler
      ? crawlerResult.value
      : null;

  return {
    actionCenterState: !canViewAgentic
      ? 'unauthorized'
      : actionHealth
        ? 'ready'
        : actionHealthResult.status === 'rejected' &&
            isPermissionDeniedError(actionHealthResult.reason)
          ? 'unauthorized'
          : 'error',
    actionHealth,
    crawlerCenterState: !canViewCrawler
      ? 'unauthorized'
      : crawlerSummary
        ? 'ready'
        : crawlerResult.status === 'rejected' &&
            isPermissionDeniedError(crawlerResult.reason)
          ? 'unauthorized'
          : 'error',
    crawlerSummary,
    isPublished,
    trustCenterState: !canViewAgentic
      ? 'unauthorized'
      : trustReadiness
        ? 'ready'
        : 'error',
    trustReadiness,
  };
}
