import 'server-only';

import { getCachedGoogleMerchantFeedData } from '@/app/api/feed/google-merchant/feed-data';
import { getCachedOpenAIFeedData } from '@/app/api/feed/openai/feed-data';
import type { MerchantData, StaffAccess } from '@/hooks/merchant';
import { loadAgenticActionHealth } from '@/lib/agentic/action-health-loader';
import {
  checkAgentCommerceUniversalCartReadiness,
  type UniversalCartReadinessResult,
} from '@/lib/agentic/agent-commerce-health-monitor';
import type { CrawlerLogSummary } from '@/lib/agentic/crawler-observability';
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
import { loadAgenticCrawlerVisibility } from './crawler-visibility-loader';

export type AgenticCenterState = 'ready' | 'error' | 'unauthorized';

export interface AgenticControlsState {
  customSettings: Record<string, unknown>;
  enabled: boolean;
}

export interface AgenticCentersData {
  agentControls: AgenticControlsState | null;
  actionCenterState: AgenticCenterState;
  actionHealth: AgenticActionHealthPayload | null;
  crawlerCenterState: AgenticCenterState;
  crawlerSummary: CrawlerLogSummary | null;
  isPublished: boolean;
  merchantId: string | null;
  trustCenterState: AgenticCenterState;
  trustReadiness: AgentCommerceTrustReadinessSummary | null;
  universalCartReadiness: UniversalCartReadinessResult | null;
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

function getRecordValue(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function buildAgenticControlsState(
  merchant: Pick<MerchantData, 'feature_settings'>
): AgenticControlsState {
  const featureSettings = getRecordValue(merchant.feature_settings);
  const customSettings = getRecordValue(featureSettings?.custom_settings) ?? {};

  return {
    customSettings,
    enabled: featureSettings?.agentic_checkout_enabled !== false,
  };
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
  const baseTrustProfile = buildMerchantTrustProfile(merchant, baseUrl);
  const [openAiFeedData, googleFeedData, trustProfile] = await Promise.all([
    getCachedOpenAIFeedData(merchant.id, true),
    getCachedGoogleMerchantFeedData(merchant.id, slug),
    enrichMerchantReviewAuthority(baseTrustProfile),
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

export async function loadAgenticCentersData(): Promise<AgenticCentersData> {
  const { merchant, staffAccess } = await getMerchantForUser();
  const canViewAgentic = canViewAgenticCenters(staffAccess);
  const canViewCrawler = canViewCrawlerVisibility(staffAccess);

  if (!merchant || (!canViewAgentic && !canViewCrawler)) {
    return {
      agentControls: null,
      actionCenterState: 'unauthorized',
      actionHealth: null,
      crawlerCenterState: 'unauthorized',
      crawlerSummary: null,
      isPublished: Boolean(merchant?.is_published),
      merchantId: merchant?.id ?? null,
      trustCenterState: 'unauthorized',
      trustReadiness: null,
      universalCartReadiness: null,
    };
  }

  const isPublished = Boolean(merchant.is_published);
  if (!isPublished) {
    return {
      agentControls: canViewAgentic
        ? buildAgenticControlsState(merchant)
        : null,
      actionCenterState: canViewAgentic ? 'ready' : 'unauthorized',
      actionHealth: null,
      crawlerCenterState: canViewCrawler ? 'ready' : 'unauthorized',
      crawlerSummary: null,
      isPublished,
      merchantId: merchant.id,
      trustCenterState: canViewAgentic ? 'ready' : 'unauthorized',
      trustReadiness: null,
      universalCartReadiness: null,
    };
  }

  const supabase = await createClient();
  const [
    actionHealthResult,
    trustReadinessResult,
    crawlerResult,
    universalCartResult,
  ] = await Promise.allSettled([
    canViewAgentic ? loadAgenticActionHealth(supabase, merchant.id) : null,
    canViewAgentic ? loadAgenticTrustReadiness(merchant) : null,
    canViewCrawler ? loadAgenticCrawlerVisibility(supabase, merchant.id) : null,
    canViewAgentic
      ? checkAgentCommerceUniversalCartReadiness({
          custom_domain: merchant.custom_domain,
          slug: merchant.slug ?? merchant.id,
        })
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

  if (canViewAgentic && universalCartResult.status === 'rejected') {
    console.error(
      'Failed to fetch Universal Cart readiness:',
      sanitizeErrorMessage(universalCartResult.reason)
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
  const universalCartReadiness =
    universalCartResult.status === 'fulfilled' && canViewAgentic
      ? universalCartResult.value
      : null;

  return {
    agentControls: canViewAgentic ? buildAgenticControlsState(merchant) : null,
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
    merchantId: merchant.id,
    trustCenterState: !canViewAgentic
      ? 'unauthorized'
      : trustReadiness
        ? 'ready'
        : 'error',
    trustReadiness,
    universalCartReadiness,
  };
}
