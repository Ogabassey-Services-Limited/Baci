import 'server-only';

import { getCachedGoogleMerchantFeedData } from '@/app/api/feed/google-merchant/feed-data';
import { getCachedOpenAIFeedData } from '@/app/api/feed/openai/feed-data';
import type { StaffAccess } from '@/hooks/merchant';
import { loadAgenticActionHealth } from '@/lib/agentic/action-health-loader';
import { getMerchantForUser } from '@/lib/merchant-server';
import { sanitizeErrorMessage } from '@/lib/sanitize-error-message';
import { buildStoreUrl } from '@/lib/store-url';
import {
  type AgentCommerceTrustReadinessSummary,
  buildAgentCommerceTrustReadiness,
  summarizeAgentCommerceTrustReadiness,
} from '@/lib/storefront-trust/build-agent-commerce-trust-readiness';
import { buildMerchantTrustProfile } from '@/lib/storefront-trust/build-merchant-trust-profile';
import type { MerchantTrustProfileSource } from '@/lib/storefront-trust/merchant-trust-profile-types';
import { createClient } from '@/lib/supabase/server';
import type { AgenticActionHealthPayload } from '@/schemas/agentic-action-health';

export type AgenticCenterState = 'ready' | 'error' | 'unauthorized';

export interface AgenticCentersData {
  actionCenterState: AgenticCenterState;
  actionHealth: AgenticActionHealthPayload | null;
  isPublished: boolean;
  trustCenterState: AgenticCenterState;
  trustReadiness: AgentCommerceTrustReadinessSummary | null;
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

export async function loadAgenticCentersData(): Promise<AgenticCentersData> {
  const { merchant, staffAccess } = await getMerchantForUser();

  if (!merchant || !canViewAgenticCenters(staffAccess)) {
    return {
      actionCenterState: 'unauthorized',
      actionHealth: null,
      isPublished: Boolean(merchant?.is_published),
      trustCenterState: 'unauthorized',
      trustReadiness: null,
    };
  }

  const isPublished = Boolean(merchant.is_published);
  if (!isPublished) {
    return {
      actionCenterState: 'ready',
      actionHealth: null,
      isPublished,
      trustCenterState: 'ready',
      trustReadiness: null,
    };
  }

  const supabase = await createClient();
  const [actionHealthResult, trustReadinessResult] = await Promise.allSettled([
    loadAgenticActionHealth(supabase, merchant.id),
    loadAgenticTrustReadiness(merchant),
  ]);

  if (
    actionHealthResult.status === 'rejected' &&
    !isPermissionDeniedError(actionHealthResult.reason)
  ) {
    console.error(
      'Failed to fetch action health:',
      sanitizeErrorMessage(actionHealthResult.reason)
    );
  }

  if (trustReadinessResult.status === 'rejected') {
    console.error(
      'Failed to fetch trust readiness:',
      sanitizeErrorMessage(trustReadinessResult.reason)
    );
  }

  const actionHealth =
    actionHealthResult.status === 'fulfilled' ? actionHealthResult.value : null;
  const trustReadiness =
    trustReadinessResult.status === 'fulfilled'
      ? trustReadinessResult.value
      : null;

  return {
    actionCenterState: actionHealth
      ? 'ready'
      : actionHealthResult.status === 'rejected' &&
          isPermissionDeniedError(actionHealthResult.reason)
        ? 'unauthorized'
        : 'error',
    actionHealth,
    isPublished,
    trustCenterState: trustReadiness ? 'ready' : 'error',
    trustReadiness,
  };
}
