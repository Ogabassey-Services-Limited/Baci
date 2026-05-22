import type { SupabaseClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { getCronSecret } from '@/env';
import { loadAgenticActionHealth } from '@/lib/agentic/action-health-loader';
import { hasValidCronSecret } from '@/lib/cron-secret-auth';
import { logger } from '@/lib/logger';
import { sanitizeForLog } from '@/lib/sanitize-core';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AgenticAction } from '@/schemas/agentic-action-health';
import { agenticCommerceHealthCronQuerySchema } from '@/schemas/agentic-commerce-health-cron';

export const maxDuration = 300;

const DEFAULT_MONITORED_MERCHANT_SLUG = 'ogabassey';
const MERCHANT_SELECT_COLUMNS = 'id, slug, business_name, is_published';

type AgenticCommerceHealthStatus = 'ok' | 'monitor' | 'attention';

interface MonitoredMerchantRow {
  business_name: string | null;
  id: string;
  is_published: boolean | null;
  slug: string | null;
}

interface AgenticCommerceHealthActionSummary {
  code: string;
  count: number;
  severity: AgenticAction['severity'];
}

interface AgenticCommerceHealthMerchantResult {
  actions: AgenticCommerceHealthActionSummary[];
  business_name?: string;
  merchant_id?: string;
  slug: string;
  status: AgenticCommerceHealthStatus;
  status_reason: string;
}

function normalizeMerchantSlug(value: string) {
  return value.trim().toLowerCase();
}

function getMonitorSlugsFromEnv() {
  const rawValue =
    process.env.AGENTIC_HEALTH_MONITOR_MERCHANT_SLUGS ??
    process.env.OPENAI_AGENTIC_MERCHANT_SLUG ??
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

function summarizeActions(actions: AgenticAction[]) {
  return actions
    .filter((action) => action.severity !== 'ok' || action.count > 0)
    .map((action) => ({
      code: action.code,
      count: action.count,
      severity: action.severity,
    }));
}

function getMerchantHealthStatus(actions: AgenticAction[]) {
  if (
    actions.some(
      (action) => action.severity === 'attention' && action.count > 0
    )
  ) {
    return 'attention';
  }

  if (
    actions.some((action) => action.severity === 'monitor' && action.count > 0)
  ) {
    return 'monitor';
  }

  return 'ok';
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
    const health = await loadAgenticActionHealth(supabase, merchant.id);
    const status = getMerchantHealthStatus(health.actions);
    return {
      actions: summarizeActions(health.actions),
      business_name: merchant.business_name ?? undefined,
      merchant_id: merchant.id,
      slug,
      status,
      status_reason: `agentic_action_health_${status}`,
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
    const merchants = await Promise.all(
      monitorRequest.slugs.map((slug) =>
        buildMerchantHealthResult({
          merchant: merchantsBySlug.get(slug),
          slug,
          supabase,
        })
      )
    );
    const status = getOverallStatus(merchants);
    const summary = {
      checked_at: new Date().toISOString(),
      merchant_count: merchants.length,
      merchants,
      status,
    };

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
