import type { SupabaseClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { parseRequestedMerchantId } from '@/app/api/branches/branch-route-utils';
import { getInternalApiSecret, getRootDomain } from '@/env';
import {
  buildCrawlerLogSummary,
  type CrawlerLogSummaryRow,
  getCrawlerClassificationForEvent,
  normalizeCrawlerHost,
  normalizeCrawlerPath,
} from '@/lib/agentic/crawler-observability';
import { authenticateApiRequest, hasPermission } from '@/lib/api-auth';
import { constantTimeEqual } from '@/lib/constant-time-equal';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { logger } from '@/lib/logger';
import { sanitizeForLog } from '@/lib/sanitize-core';
import { resolveStorefrontRouteIdentifiers } from '@/lib/storefront-host';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  crawlerLogPostSchema,
  crawlerLogQuerySchema,
} from '@/schemas/crawler-observability';

/**
 * Crawler Log API
 *
 * Logs search engine crawler visits for SEO monitoring.
 * This endpoint is called asynchronously from middleware and should be fast.
 *
 * Data is stored in the crawler_logs table for analysis:
 * - Which pages are being crawled
 * - How often different bots visit
 * - Trends in crawl frequency
 */

const PLATFORM_PATH_PREFIXES = new Set([
  'api',
  'auth',
  'dashboard',
  'login',
  'onboarding',
]);

function isAuthorizedInternalCrawlerLogRequest(request: NextRequest) {
  const secret = getInternalApiSecret();
  if (!secret) {
    return { configured: false, ok: false };
  }

  return {
    configured: true,
    ok: constantTimeEqual(
      request.headers.get('authorization') ?? '',
      `Bearer ${secret}`
    ),
  };
}

function getIdentifierCandidates(host: string | null, path: string) {
  if (!host) return getPathIdentifierCandidates(path);

  const request = new Request(`https://${host}${path}`, {
    headers: { host },
  });
  const identifiers = resolveStorefrontRouteIdentifiers({
    request,
    rootDomain: getRootDomain() ?? 'usebaci.com',
  });

  return identifiers.length > 0
    ? identifiers
    : getPathIdentifierCandidates(path);
}

function getPathIdentifierCandidates(path: string) {
  const firstSegment = path.split('?')[0]?.split('/').filter(Boolean)[0];
  if (!firstSegment || PLATFORM_PATH_PREFIXES.has(firstSegment)) return [];
  return [firstSegment];
}

async function resolveCrawlerMerchantId(
  supabase: SupabaseClient,
  host: string | null,
  path: string
): Promise<string | null> {
  const candidates = getIdentifierCandidates(host, path);

  for (const candidate of candidates) {
    if (candidate.includes('.')) {
      const { data: domain, error: domainError } = await supabase
        .from('domains')
        .select('merchant_id')
        .eq('domain', candidate)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();

      if (!domainError && domain?.merchant_id) {
        return domain.merchant_id as string;
      }
    }

    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();

    if (!merchantError && merchant?.id) {
      return merchant.id as string;
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const auth = isAuthorizedInternalCrawlerLogRequest(request);
    if (!auth.configured) {
      return NextResponse.json({
        success: true,
        logged: false,
        reason: 'logging_unconfigured',
      });
    }

    if (!auth.ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = crawlerLogPostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          code: 'INVALID_CRAWLER_LOG',
          error:
            parsed.error.issues[0]?.message ?? 'Invalid crawler log payload',
        },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const path = normalizeCrawlerPath(parsed.data.urlPath);
    const host = normalizeCrawlerHost(
      parsed.data.host ??
        request.headers.get('x-forwarded-host') ??
        request.headers.get('host')
    );
    const classification = getCrawlerClassificationForEvent(parsed.data);
    const merchantId = await resolveCrawlerMerchantId(supabase, host, path);

    // Insert crawler log
    const { error } = await supabase.from('crawler_logs').insert({
      agent_family: classification.family,
      bot_name: classification.botName,
      cache_outcome: parsed.data.cacheOutcome,
      host,
      merchant_id: merchantId,
      response_time_ms: parsed.data.responseTimeMs ?? null,
      status_code: parsed.data.statusCode,
      url_path: path,
      user_agent: parsed.data.userAgent ?? null,
    });

    if (error) {
      // Log but don't fail - this is non-critical
      logger.warn({
        error: sanitizeForLog(error),
        message: 'Failed to log crawler visit',
      });
    }

    return NextResponse.json({ success: true, logged: !error });
  } catch (error) {
    // Silently fail - crawler logging should never break the app
    logger.warn({
      error: sanitizeForLog(error),
      message: 'Crawler log error',
    });
    return NextResponse.json({ success: true, logged: false });
  }
}

// GET endpoint to retrieve crawler stats (for dashboard)
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth.user || !auth.supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parsedQuery = crawlerLogQuerySchema.safeParse({
      days: request.nextUrl.searchParams.get('days') ?? undefined,
      limit: request.nextUrl.searchParams.get('limit') ?? undefined,
    });
    if (!parsedQuery.success) {
      return NextResponse.json(
        {
          code: 'INVALID_QUERY',
          error:
            parsedQuery.error.issues[0]?.message ?? 'Invalid crawler log query',
        },
        { status: 400 }
      );
    }

    const requestedMerchant = parseRequestedMerchantId(request);
    if (requestedMerchant.response) {
      return requestedMerchant.response;
    }

    const merchantContext = await getMerchantForApiRequest(
      auth.supabase,
      auth.user.id,
      { requestedMerchantId: requestedMerchant.merchantId }
    );
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'analytics', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { days, limit } = parsedQuery.data;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await auth.supabase
      .from('crawler_logs')
      .select(
        'agent_family, bot_name, cache_outcome, crawled_at, host, response_time_ms, status_code, url_path, user_agent'
      )
      .eq('merchant_id', merchantContext.merchantId)
      .gte('crawled_at', startDate.toISOString())
      .order('crawled_at', { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch crawler logs' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      buildCrawlerLogSummary((data ?? []) as CrawlerLogSummaryRow[], days)
    );
  } catch (error) {
    logger.error({
      error: sanitizeForLog(error),
      message: 'Crawler stats error',
    });
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
