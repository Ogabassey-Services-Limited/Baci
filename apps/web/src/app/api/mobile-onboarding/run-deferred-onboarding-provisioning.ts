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
 * A single, narrowly-scoped capability rather than a privileged client.
 *
 * This module deliberately does NOT receive a service-role client. Handing over
 * a whole admin client would extend RLS-bypassing authority to a sibling
 * module, which the repository forbids — no sibling inherits that
 * authorization. Instead route.ts, the module the boundary contract authorizes,
 * both imports the factory AND defines exactly what the privileged operation
 * is: publish this merchant's home page. Nothing else here can perform a
 * privileged write.
 */
// PromiseLike, not Promise: a PostgREST query builder is thenable but is not a
// Promise instance, so the authorized caller can hand its builder straight back.
export type PublishHomePage = (
  config: unknown
) => PromiseLike<{ error: unknown }>;

export interface DeferredOnboardingProvisioningInput {
  publishHomePage: PublishHomePage;
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
  publishHomePage,
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
      const { error: pageConfigError } = await publishHomePage(config);
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
      // Reports most failures by RESOLVING { success: false, error } rather
      // than throwing, so the catch below would never see them.
      const result = await assignHeroImagesToMerchant(
        merchantId,
        businessType.toLowerCase(),
        false
      );
      if (!result?.success) {
        logOnboardingFailure(result?.error ?? 'hero image assignment failed', {
          stage: 'hero_image_assignment',
          merchantId,
        });
      }
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
