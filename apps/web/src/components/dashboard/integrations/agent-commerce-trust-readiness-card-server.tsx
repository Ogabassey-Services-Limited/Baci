import { getCachedGoogleMerchantFeedData } from '@/app/api/feed/google-merchant/feed-data';
import { getCachedOpenAIFeedData } from '@/app/api/feed/openai/feed-data';
import { logger } from '@/lib/logger';
import { sanitizeForLog } from '@/lib/sanitize-core';
import { buildStoreUrl } from '@/lib/store-url';
import {
  type AgentCommerceTrustReadiness,
  buildAgentCommerceTrustReadiness,
} from '@/lib/storefront-trust/build-agent-commerce-trust-readiness';
import { buildMerchantTrustProfile } from '@/lib/storefront-trust/build-merchant-trust-profile';
import { enrichMerchantReviewAuthority } from '@/lib/storefront-trust/enrich-merchant-review-authority';
import type { MerchantTrustProfileSource } from '@/lib/storefront-trust/merchant-trust-profile-types';
import { AgentCommerceTrustReadinessCard } from './agent-commerce-trust-readiness-card';

interface AgentCommerceTrustReadinessMerchant
  extends MerchantTrustProfileSource {
  id: string;
  slug?: string | null;
  business_name: string;
  custom_domain?: string | null;
}

interface AgentCommerceTrustReadinessCardServerProps {
  merchant: AgentCommerceTrustReadinessMerchant;
}

export async function AgentCommerceTrustReadinessCardServer({
  merchant,
}: AgentCommerceTrustReadinessCardServerProps) {
  const slug = merchant.slug ?? merchant.id;
  const baseUrl = buildStoreUrl({
    slug,
    custom_domain: merchant.custom_domain ?? undefined,
  });

  // try/catch guards the data loading only; JSX is constructed outside of it
  // so rendering errors surface to the nearest error boundary.
  let readiness: AgentCommerceTrustReadiness | null = null;
  try {
    const baseTrustProfile = buildMerchantTrustProfile(merchant, baseUrl);
    const [openAiFeedData, googleFeedData, trustProfile] = await Promise.all([
      getCachedOpenAIFeedData(merchant.id, true),
      getCachedGoogleMerchantFeedData(merchant.id, slug),
      enrichMerchantReviewAuthority(baseTrustProfile),
    ]);
    readiness = buildAgentCommerceTrustReadiness({
      baseUrl,
      googleFeedData,
      merchant: {
        business_name: merchant.business_name,
        slug,
      },
      openAiFeedData,
      trustProfile,
    });
  } catch (error) {
    logger.error({
      message: 'Failed to load agent trust readiness in trust settings',
      error: sanitizeForLog(error),
      merchantId: merchant.id,
    });
  }

  if (!readiness) {
    return (
      <AgentCommerceTrustReadinessCard
        readiness={null}
        error="Unable to load agent trust health"
      />
    );
  }

  return <AgentCommerceTrustReadinessCard readiness={readiness} />;
}
