import type { SupabaseClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { getCronSecret } from '@/env';
import { loadAgenticActionHealth } from '@/lib/agentic/action-health-loader';
import {
  type AgenticActionHealthSummary,
  summarizeAgenticActionHealth,
} from '@/lib/agentic/action-health-summary';
import type { AgentCommerceFeedHealthResult } from '@/lib/agentic/agent-commerce-feed-health';
import {
  buildAgentCommerceFeedHealthActions,
  checkAgentCommerceFeedHealth,
  getAgentCommerceFeedStatusReason,
} from '@/lib/agentic/agent-commerce-feed-health';
import {
  type AgentCommerceCrawlerHealthResult,
  type AgenticCommerceHealthActionSummary,
  type AgenticCommerceHealthStatus,
  buildAgentCommerceCrawlerHealthActions,
  buildAgentCommerceManifestHealthActions,
  buildAgentCommerceUniversalCartHealthActions,
  checkAgentCommerceCrawlerHealth,
  checkAgentCommerceUniversalCartReadiness,
  fetchPrimaryAgenticMerchantDomains,
  getAgentCommerceCrawlerStatusReason,
  getAgentCommerceManifestStatusReason,
  getAgentCommerceUniversalCartStatusReason,
  getAgenticCommerceHealthStatus,
  summarizeAgenticCommerceHealthActions,
  type UniversalCartReadinessResult,
} from '@/lib/agentic/agent-commerce-health-monitor';
import {
  type AgentCommerceManifestHealthResult,
  checkAgentCommerceManifestHealth,
} from '@/lib/agentic/agent-commerce-manifest-health';
import {
  type AgentCommercePublicProductParityResult,
  buildAgentCommercePublicProductParityActions,
  checkAgentCommercePublicProductParity,
  getAgentCommercePublicProductParityStatusReason,
} from '@/lib/agentic/agent-commerce-public-product-parity-health';
import { checkAgentCommerceSupportChatHealth } from '@/lib/agentic/agent-commerce-support-chat-health';
import {
  type AgentCommerceTrustHealthResult,
  buildAgentCommerceTrustHealthActions,
  checkAgentCommerceTrustHealth,
  getAgentCommerceTrustStatusReason,
} from '@/lib/agentic/agent-commerce-trust-health';
import { hasValidCronSecret } from '@/lib/cron-secret-auth';
import { logger } from '@/lib/logger';
import { sanitizeForLog } from '@/lib/sanitize-core';
import { createAdminClient } from '@/lib/supabase/admin';
import { agenticCommerceHealthCronQuerySchema } from '@/schemas/agentic-commerce-health-cron';

export const maxDuration = 300;

const DEFAULT_MONITORED_MERCHANT_SLUG = 'ogabassey';
const MERCHANT_SELECT_COLUMNS = 'id, slug, business_name, is_published';

interface MonitoredMerchantRow {
  business_name: string | null;
  custom_domain?: string | null;
  id: string;
  is_published: boolean | null;
  slug: string | null;
}

interface AgenticCommerceHealthMerchantResult {
  actions: AgenticCommerceHealthActionSummary[];
  action_health?: AgenticActionHealthSummary;
  business_name?: string;
  crawler?: AgentCommerceCrawlerHealthResult;
  feeds?: AgentCommerceFeedHealthResult;
  manifest?: AgentCommerceManifestHealthResult;
  merchant_id?: string;
  parity?: AgentCommercePublicProductParityResult;
  slug: string;
  status: AgenticCommerceHealthStatus;
  status_reason: string;
  trust?: AgentCommerceTrustHealthResult;
  universal_cart?: UniversalCartReadinessResult;
}

function normalizeMerchantSlug(value: string) {
  return value.trim().toLowerCase();
}

function getMonitorSlugsFromEnv() {
  const rawValue =
    process.env.AGENTIC_HEALTH_MONITOR_MERCHANT_SLUGS?.trim() ||
    process.env.BACI_AGENTIC_MERCHANT_SLUG?.trim() ||
    process.env.OPENAI_AGENTIC_MERCHANT_SLUG?.trim() ||
    DEFAULT_MONITORED_MERCHANT_SLUG;
  const parsed = agenticCommerceHealthCronQuerySchema.safeParse({
    merchant_slug: [rawValue],
  });

  if (parsed.success && parsed.data.merchant_slug.length > 0) {
    return parsed.data.merchant_slug;
  }

  logger.warn({
    message: 'Invalid agentic health monitor merchant slugs; using default',
  });
  return [DEFAULT_MONITORED_MERCHANT_SLUG];
}

function getRequestedMonitorSlugs(request: NextRequest) {
  const url = new URL(request.url);
  const parsed = agenticCommerceHealthCronQuerySchema.safeParse({
    fail_on_attention: url.searchParams.get('fail_on_attention') ?? undefined,
    merchant_slug: url.searchParams.getAll('merchant_slug'),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.flatten(),
      ok: false as const,
    };
  }

  return {
    failOnAttention: parsed.data.fail_on_attention,
    ok: true as const,
    slugs:
      parsed.data.merchant_slug.length > 0
        ? parsed.data.merchant_slug
        : getMonitorSlugsFromEnv(),
  };
}

function getOverallStatus(
  merchants: AgenticCommerceHealthMerchantResult[]
): AgenticCommerceHealthStatus {
  if (merchants.some((merchant) => merchant.status === 'attention')) {
    return 'attention';
  }
  if (merchants.some((merchant) => merchant.status === 'monitor')) {
    return 'monitor';
  }
  return 'ok';
}

async function fetchMonitoredMerchants(
  supabase: SupabaseClient,
  slugs: string[]
) {
  const { data, error } = await supabase
    .from('merchants')
    .select(MERCHANT_SELECT_COLUMNS)
    .in('slug', slugs);

  if (error) {
    throw error;
  }

  return ((data ?? []) as MonitoredMerchantRow[]).reduce((rowsBySlug, row) => {
    if (row.slug) rowsBySlug.set(normalizeMerchantSlug(row.slug), row);
    return rowsBySlug;
  }, new Map<string, MonitoredMerchantRow>());
}

async function buildMerchantHealthResult({
  merchant,
  slug,
  supabase,
}: {
  merchant: MonitoredMerchantRow | undefined;
  slug: string;
  supabase: SupabaseClient;
}): Promise<AgenticCommerceHealthMerchantResult> {
  if (!merchant) {
    return {
      actions: [],
      slug,
      status: 'attention',
      status_reason: 'monitored_merchant_not_found',
    };
  }

  if (!merchant.is_published) {
    return {
      actions: [],
      business_name: merchant.business_name ?? undefined,
      merchant_id: merchant.id,
      slug,
      status: 'attention',
      status_reason: 'monitored_merchant_not_published',
    };
  }

  try {
    const [health, manifest, feeds, crawler, trust, parity, universalCart] =
      await Promise.all([
        loadAgenticActionHealth(supabase, merchant.id, {
          recordsSource: 'admin_direct',
        }),
        checkAgentCommerceManifestHealth({
          custom_domain: merchant.custom_domain,
          slug,
        }),
        checkAgentCommerceFeedHealth({
          merchantId: merchant.id,
          slug,
          supabase,
        }),
        checkAgentCommerceCrawlerHealth(supabase, merchant.id),
        checkAgentCommerceTrustHealth({
          custom_domain: merchant.custom_domain,
          slug,
        }),
        checkAgentCommercePublicProductParity({
          custom_domain: merchant.custom_domain,
          slug,
        }),
        checkAgentCommerceUniversalCartReadiness({
          custom_domain: merchant.custom_domain,
          slug,
        }),
      ]);
    const manifestActions = buildAgentCommerceManifestHealthActions(manifest);
    const feedActions = buildAgentCommerceFeedHealthActions(feeds);
    const crawlerActions = buildAgentCommerceCrawlerHealthActions(crawler);
    const trustActions = buildAgentCommerceTrustHealthActions(trust);
    const parityActions = buildAgentCommercePublicProductParityActions(parity);
    const universalCartActions =
      buildAgentCommerceUniversalCartHealthActions(universalCart);
    const mergedActions = [
      ...health.actions,
      ...manifestActions,
      ...feedActions,
      ...crawlerActions,
      ...trustActions,
      ...parityActions,
      ...universalCartActions,
    ];
    const status = getAgenticCommerceHealthStatus(mergedActions);
    return {
      actions: summarizeAgenticCommerceHealthActions(mergedActions),
      action_health: summarizeAgenticActionHealth(health),
      business_name: merchant.business_name ?? undefined,
      crawler,
      feeds,
      manifest,
      merchant_id: merchant.id,
      parity,
      slug,
      status,
      status_reason: getAgentCommercePublicProductParityStatusReason(
        parity,
        getAgentCommerceUniversalCartStatusReason(
          universalCart,
          getAgentCommerceTrustStatusReason(
            trust,
            getAgentCommerceCrawlerStatusReason(
              crawler,
              getAgentCommerceFeedStatusReason(
                feeds,
                getAgentCommerceManifestStatusReason(
                  manifest,
                  `agentic_action_health_${status}`
                )
              )
            )
          )
        )
      ),
      trust,
      universal_cart: universalCart,
    };
  } catch (_error) {
    return {
      actions: [],
      business_name: merchant.business_name ?? undefined,
      merchant_id: merchant.id,
      slug,
      status: 'attention',
      status_reason: 'agentic_action_health_load_failed',
    };
  }
}

export async function GET(request: NextRequest) {
  const cronSecret = getCronSecret();
  if (!cronSecret) {
    return NextResponse.json(
      { error: 'Server misconfigured', code: 'server_misconfigured' },
      { status: 500 }
    );
  }

  if (!hasValidCronSecret(request.headers, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const monitorRequest = getRequestedMonitorSlugs(request);
  if (!monitorRequest.ok) {
    return NextResponse.json(
      { error: 'Invalid monitor query', details: monitorRequest.error },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  try {
    const merchantsBySlug = await fetchMonitoredMerchants(
      supabase,
      monitorRequest.slugs
    );
    const primaryDomainsByMerchantId = await fetchPrimaryAgenticMerchantDomains(
      supabase,
      Array.from(merchantsBySlug.values(), (merchant) => merchant.id)
    );
    const [merchants, supportChat] = await Promise.all([
      Promise.all(
        monitorRequest.slugs.map((slug) => {
          const merchant = merchantsBySlug.get(slug);
          return buildMerchantHealthResult({
            merchant: merchant
              ? {
                  ...merchant,
                  custom_domain:
                    primaryDomainsByMerchantId.get(merchant.id) ?? null,
                }
              : undefined,
            slug,
            supabase,
          });
        })
      ),
      checkAgentCommerceSupportChatHealth(),
    ]);
    const status = getOverallStatus(merchants);
    const summary = {
      checked_at: new Date().toISOString(),
      merchant_count: merchants.length,
      merchants,
      status,
      support_chat: supportChat,
    };

    if (supportChat.status === 'attention') {
      logger.warn({
        message: 'Support chat health monitor needs attention',
        support_chat: supportChat,
      });
    }

    if (status === 'attention') {
      logger.warn({
        message: 'Agentic commerce health monitor needs attention',
        summary,
      });
    } else {
      logger.info({
        message: 'Agentic commerce health monitor completed',
        summary,
      });
    }

    return NextResponse.json(summary, {
      status:
        status === 'attention' && monitorRequest.failOnAttention ? 503 : 200,
    });
  } catch (error) {
    logger.error({
      message: 'Agentic commerce health monitor failed',
      error: sanitizeForLog(error),
    });
    return NextResponse.json(
      { error: 'Internal server error', code: 'internal_error' },
      { status: 500 }
    );
  }
}
