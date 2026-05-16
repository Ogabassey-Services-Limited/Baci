import { cookies } from 'next/headers';
import { loadAgenticActionHealth } from '@/lib/agentic/action-health-loader';
import { getMerchantForUser } from '@/lib/merchant-server';
import { buildStoreUrl } from '@/lib/store-url';
import {
  type AgentCommerceTrustReadinessSummary,
  buildAgentCommerceTrustReadiness,
  summarizeAgentCommerceTrustReadiness,
} from '@/lib/storefront-trust/build-agent-commerce-trust-readiness';
import { buildMerchantTrustProfile } from '@/lib/storefront-trust/build-merchant-trust-profile';
import type { MerchantTrustProfileSource } from '@/lib/storefront-trust/merchant-trust-profile-types';
import { createClient } from '@/lib/supabase/server';
import { getCachedGoogleMerchantFeedData } from '../api/feed/google-merchant/feed-data';
import { getCachedOpenAIFeedData } from '../api/feed/openai/feed-data';
import {
  getDashboardMetrics,
  getMonthlyChartData,
  getRecentSales,
} from './actions';
import DashboardClientPage from './client-page';

// Configuration constants
const RECENT_SALES_LIMIT = 5;

// Sanitize error output to avoid leaking sensitive info
function sanitizeError(reason: unknown): string {
  if (
    reason &&
    typeof reason === 'object' &&
    'message' in reason &&
    typeof (reason as { message: unknown }).message === 'string'
  ) {
    return (reason as { message: string }).message;
  }
  if (typeof reason === 'string') {
    return reason;
  }
  return 'Unknown error';
}

function isPermissionDeniedError(reason: unknown): boolean {
  if (!reason || typeof reason !== 'object') return false;

  const errorRecord = reason as Record<string, unknown>;
  const code = errorRecord.code;
  if (code === '42501') return true;

  const message = errorRecord.message;
  return (
    typeof message === 'string' &&
    message.toLowerCase().includes('permission denied')
  );
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
  const trustProfile = buildMerchantTrustProfile(merchant, baseUrl);
  const [openAiFeedData, googleFeedData] = await Promise.all([
    getCachedOpenAIFeedData(merchant.id),
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

export async function DashboardData() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { merchant } = await getMerchantForUser();

  if (!merchant) {
    return (
      <DashboardClientPage
        initialActionCenterState="unauthorized"
        initialTrustCenterState="unauthorized"
      />
    );
  }

  // Trust readiness only renders on the dashboard when the store is
  // published (see the `merchant?.is_published` gates in client-page.tsx),
  // so skip the expensive feed/profile work entirely for unpublished stores.
  const isPublished = Boolean(merchant.is_published);

  // Use Promise.allSettled to handle partial failures gracefully
  const [
    metricsResult,
    recentSalesResult,
    chartDataResult,
    actionHealthResult,
    trustReadinessResult,
  ] = await Promise.allSettled([
    getDashboardMetrics(merchant.id),
    getRecentSales(merchant.id, RECENT_SALES_LIMIT),
    getMonthlyChartData(merchant.id),
    isPublished
      ? loadAgenticActionHealth(supabase, merchant.id)
      : Promise.resolve(null),
    isPublished
      ? loadAgenticTrustReadiness(merchant)
      : Promise.resolve<AgentCommerceTrustReadinessSummary | null>(null),
  ]);

  const metrics =
    metricsResult.status === 'fulfilled' ? metricsResult.value : null;
  const recentSales =
    recentSalesResult.status === 'fulfilled' ? recentSalesResult.value : [];
  const monthlyChartData =
    chartDataResult.status === 'fulfilled' ? chartDataResult.value : [];
  const actionHealth =
    actionHealthResult.status === 'fulfilled' ? actionHealthResult.value : null;
  const trustReadiness =
    trustReadinessResult.status === 'fulfilled'
      ? trustReadinessResult.value
      : null;

  // Log any errors for debugging with sanitized output
  if (metricsResult.status === 'rejected') {
    console.error(
      'Failed to fetch dashboard metrics:',
      sanitizeError(metricsResult.reason)
    );
  }
  if (recentSalesResult.status === 'rejected') {
    console.error(
      'Failed to fetch recent sales:',
      sanitizeError(recentSalesResult.reason)
    );
  }
  if (chartDataResult.status === 'rejected') {
    console.error(
      'Failed to fetch chart data:',
      sanitizeError(chartDataResult.reason)
    );
  }
  if (actionHealthResult.status === 'rejected') {
    if (!isPermissionDeniedError(actionHealthResult.reason)) {
      console.error(
        'Failed to fetch action health:',
        sanitizeError(actionHealthResult.reason)
      );
    }
  }
  if (trustReadinessResult.status === 'rejected') {
    console.error(
      'Failed to fetch trust readiness:',
      sanitizeError(trustReadinessResult.reason)
    );
  }

  const actionCenterState: 'ready' | 'error' | 'unauthorized' = !isPublished
    ? 'ready'
    : actionHealth
      ? 'ready'
      : actionHealthResult.status === 'rejected' &&
          isPermissionDeniedError(actionHealthResult.reason)
        ? 'unauthorized'
        : 'error';

  return (
    <DashboardClientPage
      initialActionCenterState={actionCenterState}
      initialActionHealth={actionHealth}
      initialMetrics={metrics ?? undefined}
      initialRecentSales={recentSales}
      initialChartData={monthlyChartData}
      initialTrustCenterState={
        !isPublished || trustReadiness ? 'ready' : 'error'
      }
      initialTrustReadiness={trustReadiness}
    />
  );
}
