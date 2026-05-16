import { getMerchantForUser } from '@/lib/merchant-server';
import { buildStoreUrl } from '@/lib/store-url';
import { buildAgentCommerceTrustReadiness } from '@/lib/storefront-trust/build-agent-commerce-trust-readiness';
import { buildMerchantTrustProfile } from '@/lib/storefront-trust/build-merchant-trust-profile';
import type { MerchantTrustProfileSource } from '@/lib/storefront-trust/merchant-trust-profile-types';
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

  return buildAgentCommerceTrustReadiness({
    baseUrl,
    googleFeedData,
    merchant: {
      business_name: merchant.business_name,
      slug,
    },
    openAiFeedData,
    trustProfile,
  });
}

export async function DashboardData() {
  const { merchant } = await getMerchantForUser();

  if (!merchant) {
    return <DashboardClientPage initialTrustCenterState="unauthorized" />;
  }

  // Use Promise.allSettled to handle partial failures gracefully
  const [
    metricsResult,
    recentSalesResult,
    chartDataResult,
    trustReadinessResult,
  ] = await Promise.allSettled([
    getDashboardMetrics(merchant.id),
    getRecentSales(merchant.id, RECENT_SALES_LIMIT),
    getMonthlyChartData(merchant.id),
    loadAgenticTrustReadiness(merchant),
  ]);

  const metrics =
    metricsResult.status === 'fulfilled' ? metricsResult.value : null;
  const recentSales =
    recentSalesResult.status === 'fulfilled' ? recentSalesResult.value : [];
  const monthlyChartData =
    chartDataResult.status === 'fulfilled' ? chartDataResult.value : [];
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
  if (trustReadinessResult.status === 'rejected') {
    console.error(
      'Failed to fetch trust readiness:',
      sanitizeError(trustReadinessResult.reason)
    );
  }

  return (
    <DashboardClientPage
      initialMetrics={metrics ?? undefined}
      initialRecentSales={recentSales}
      initialChartData={monthlyChartData}
      initialTrustCenterState={trustReadiness ? 'ready' : 'error'}
      initialTrustReadiness={trustReadiness}
    />
  );
}
