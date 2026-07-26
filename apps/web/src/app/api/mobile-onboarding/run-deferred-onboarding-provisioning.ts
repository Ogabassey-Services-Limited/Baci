import type { BrandColors } from '@/types';
import { logOnboardingFailure } from './onboarding-failure-log';
import {
  type DomainProvisionClient,
  type ProvisionMerchantDomainInput,
  provisionMerchantDomain,
} from './provision-merchant-domain';

/**
 * Work that runs AFTER the onboarding response is sent: a domain retry, the
 * AI-generated starter template, and hero images. Extracted from route.ts so
 * the deferred workflow is testable on its own instead of living inline in the
 * handler.
 *
 * Every step is best-effort — the account is already usable when this runs, so
 * a failure here is logged, never thrown, and must not take down the others.
 */

const DEFAULT_BRAND_COLORS: BrandColors = {
  primary: '#000000',
  background: '#ffffff',
  accent: '#F59E0B',
};

/**
 * Minimal shape of the privileged client this needs. Injected rather than
 * constructed here on purpose: the repository's boundary contract authorizes
 * only route.ts to import the admin factory, and importing it from this module
 * would register a new admin-authority edge. Taking the client as a parameter
 * keeps the authority where it was already sanctioned — and makes this function
 * testable without mocking the factory.
 */
export interface DeferredProvisioningAdminClient {
  from: (table: string) => {
    insert: (row: Record<string, unknown>) => PromiseLike<{
      error: unknown;
    }>;
  };
}

export interface DeferredOnboardingProvisioningInput {
  adminClient: DeferredProvisioningAdminClient;
  merchantId: string;
  merchantSlug: string;
  businessName: string;
  businessType: string;
  brandColors: BrandColors | null;
  /**
   * Set only when the in-request domain insert failed. Carries the SAME
   * caller-scoped client, never a privileged one: a persistent denial is a
   * policy bug that must stay visible rather than be forced through.
   */
  domainRepair: {
    client: DomainProvisionClient;
    input: ProvisionMerchantDomainInput;
  } | null;
}

export async function runDeferredOnboardingProvisioning({
  adminClient,
  merchantId,
  merchantSlug,
  businessName,
  businessType,
  brandColors,
  domainRepair,
}: DeferredOnboardingProvisioningInput): Promise<void> {
  const repairDomain = async (): Promise<void> => {
    if (!domainRepair) {
      return;
    }
    // provisionMerchantDomain is total — it reports transport rejections as a
    // failed result rather than throwing — so no guard is needed here.
    const retry = await provisionMerchantDomain(
      domainRepair.client,
      domainRepair.input
    );
    if (!retry.provisioned) {
      // A merchant with no active domain row is the durable, queryable signal
      // that repair is still owed.
      logOnboardingFailure(retry.error, {
        stage: 'domain_repair_exhausted',
        merchantId,
      });
    }
  };

  const generateTemplate = async (): Promise<void> => {
    try {
      const { generateInitialTemplate } = await import(
        '@/lib/initial-template-generator'
      );
      const config = await generateInitialTemplate({
        businessName,
        businessType,
        brandColors: brandColors || DEFAULT_BRAND_COLORS,
        merchant: { id: merchantId, slug: merchantSlug },
      });
      const { error: pageConfigError } = await adminClient
        .from('page_configs')
        .insert({
          merchant_id: merchantId,
          page_slug: 'home',
          page_name: 'Home',
          draft_config: config,
          published_config: config,
          is_published: true,
        });
      if (pageConfigError) {
        logOnboardingFailure(pageConfigError, {
          stage: 'page_config_insert',
          merchantId,
        });
      }
    } catch (error) {
      logOnboardingFailure(error, { stage: 'template_generation', merchantId });
    }
  };

  const assignHeroImages = async (): Promise<void> => {
    try {
      const { assignHeroImagesToMerchant } = await import(
        '@/services/hero-image-generator'
      );
      await assignHeroImagesToMerchant(
        merchantId,
        businessType.toLowerCase(),
        false
      );
    } catch (error) {
      logOnboardingFailure(error, {
        stage: 'hero_image_assignment',
        merchantId,
      });
    }
  };

  // Independent of each other's outcome and each self-contained, so they run
  // concurrently rather than summing their latencies — template generation
  // calls an AI model, which is why this route carries maxDuration = 60.
  // allSettled, not all: one rejecting must never cancel the others.
  await Promise.allSettled([
    repairDomain(),
    generateTemplate(),
    assignHeroImages(),
  ]);
}
