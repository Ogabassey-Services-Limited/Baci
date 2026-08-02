import { cookies } from 'next/headers';
import { after } from 'next/server';
import {
  getAppUrl,
  getConfiguredAppUrl,
  getOllamaStorefrontModel,
  getRootDomain,
  isAiStorefrontGenerationEnabled,
  isProduction,
} from '@/env';
import { triggerAiStorefrontWorker } from '@/lib/ai-storefront/trigger-storefront-worker';
import { sendWelcomeEmail } from '@/lib/email';
import { ensureActionRateLimit } from '@/lib/ensure-action-rate-limit';
import { isEventPipelineEnqueueEnabled } from '@/lib/events/event-pipeline-config';
import { recordPlatformDomainEvent } from '@/lib/events/record-platform-domain-event';
import { logger } from '@/lib/logger';
import { normalizeBusinessName } from '@/lib/normalize-business-name';
import { createClient } from '@/lib/supabase/server';
import { parseBrandColors } from '@/schemas/brand-colors';
import { onboardingSchema } from '@/schemas/onboarding';
import type { BrandColors } from '@/types';
import type {
  OnboardingBrandColors,
  ServerActionState,
} from './onboarding-action-types';
import { resolveOnboardingUser } from './resolve-onboarding-user';
import { upsertOnboardingMerchant } from './upsert-onboarding-merchant';
export function buildOnboardingRedirectUrl(search = ''): string {
  const appUrl = getConfiguredAppUrl() ?? (isProduction() ? null : getAppUrl());
  if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL must be configured');
  const url = new URL('/onboarding', appUrl);
  url.search = search;
  return url.toString();
}
function parseOnboardingBrandColors(value?: string): {
  brandColors: OnboardingBrandColors;
  brandColorsParsed: boolean;
} {
  if (!value) return { brandColors: null, brandColorsParsed: false };
  try {
    const brandColors = parseBrandColors(JSON.parse(value));
    if (!brandColors)
      logger.error({ message: 'Parsed brand colors invalid format' });
    return { brandColors, brandColorsParsed: brandColors !== null };
  } catch (error) {
    logger.error({ message: 'Failed to parse brand colors', error });
    return { brandColors: null, brandColorsParsed: false };
  }
}
function resolveStarterBrandColors(
  parsedBrandColors: OnboardingBrandColors,
  merchant: { brand_colors?: unknown } | null
): BrandColors {
  return (
    parsedBrandColors ??
    parseBrandColors(merchant?.brand_colors) ?? {
      primary: '#000000',
      background: '#ffffff',
      accent: '#F59E0B',
    }
  );
}
export async function runSubmitOnboardingWorkflow(
  _prevState: ServerActionState,
  formData: FormData
): Promise<ServerActionState> {
  const rateLimitAllowed = await ensureActionRateLimit('onboarding-submit', {
    requests: 5,
    windowMs: 900_000,
  });
  if (!rateLimitAllowed) {
    return {
      success: false,
      message: 'Too many onboarding attempts. Please try again later.',
    };
  }
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const adminSupabase = createAdminClient();
  logger.info({ message: 'submitOnboarding started' });
  const validationResult = await onboardingSchema.safeParseAsync(
    Object.fromEntries(formData.entries())
  );
  if (!validationResult.success) {
    return {
      success: false,
      message: `Form is incomplete: ${validationResult.error.issues.map((issue) => issue.message).join(', ')}`,
      errors: validationResult.error.flatten(),
    };
  }
  const {
    email,
    password,
    businessName: rawBusinessName,
    businessType,
    otherBusinessType,
    country,
    logoUrl,
    brandColors: rawBrandColors,
  } = validationResult.data;
  const businessName = normalizeBusinessName(rawBusinessName);
  const { brandColors, brandColorsParsed } =
    parseOnboardingBrandColors(rawBrandColors);
  try {
    const { data: existingMerchant } = await adminSupabase
      .from('merchants')
      .select('id, business_name')
      .eq('email', email)
      .maybeSingle();
    if (existingMerchant?.business_name) {
      return {
        success: false,
        message:
          'An account with this email already exists. Please log in instead.',
      };
    }
    const userResolution = await resolveOnboardingUser({
      supabase,
      email,
      password,
      redirectUrl: buildOnboardingRedirectUrl(),
      businessName,
      onNewSession: () => {
        sendWelcomeEmail(email, businessName || 'Valued Merchant').catch(
          (error) =>
            logger.error({
              message: 'Failed to send welcome email',
              email,
              error,
            })
        );
      },
    });
    if (userResolution.status === 'message') {
      return { success: false, message: userResolution.message };
    }
    const persisted = await upsertOnboardingMerchant({
      supabase: adminSupabase,
      user: userResolution.user,
      email,
      businessName,
      businessType,
      otherBusinessType,
      country,
      logoUrl,
      brandColors,
      brandColorsParsed,
    });
    if (persisted.status === 'completed') {
      return {
        success: true,
        message: 'Welcome back! Redirecting to your dashboard...',
        businessName: persisted.businessName,
        merchantId: persisted.merchantId,
      };
    }
    const merchant = persisted.merchant;
    const rootDomain = getRootDomain() || 'usebaci.com';
    const { error: domainError } = await adminSupabase.from('domains').insert({
      merchant_id: merchant.id,
      domain: `${merchant.slug}.${rootDomain}`,
      tld: `.${rootDomain}`,
      domain_type: 'subdomain',
      status: 'active',
      is_primary: true,
    });
    if (domainError) {
      throw new Error(`Failed to create domain: ${domainError.message}`);
    }
    try {
      const { generateInitialTemplate } = await import(
        '@/lib/initial-template-generator'
      );
      const safeBrandColors = resolveStarterBrandColors(brandColors, merchant);
      const config = await generateInitialTemplate({
        businessName,
        businessType: persisted.businessType,
        brandColors: safeBrandColors,
        merchant,
      });
      const { data: pageConfig, error: pageConfigError } = await adminSupabase
        .from('page_configs')
        .insert({
          merchant_id: merchant.id,
          page_slug: 'home',
          page_name: 'Home',
          draft_config: config,
          published_config: config,
          is_published: true,
        })
        .select('updated_at')
        .single();
      if (pageConfigError || !pageConfig) {
        throw new Error(
          `Failed to create starter page config: ${pageConfigError?.message ?? 'No page config returned'}`
        );
      }
      if (isAiStorefrontGenerationEnabled()) {
        const { error: aiJobError } = await adminSupabase
          .from('ai_jobs')
          .insert({
            merchant_id: merchant.id,
            type: 'storefront_layout_generation',
            status: 'pending',
            idempotency_key: `storefront-layout:${merchant.id}:home:onboarding`,
            input: {
              pageSlug: 'home',
              businessName,
              businessType: persisted.businessType,
              brandColors: safeBrandColors,
              createdPageConfigUpdatedAt: pageConfig.updated_at,
            },
            model: getOllamaStorefrontModel(),
            metadata: {
              source: 'onboarding',
              createdPageConfigUpdatedAt: pageConfig.updated_at,
            },
          });
        if (aiJobError && aiJobError.code !== '23505') {
          logger.error({
            message: 'AI storefront generation job enqueue failed',
            merchantId: merchant.id,
            error: aiJobError,
          });
        }
        if (!aiJobError || aiJobError.code === '23505') {
          after(async () => {
            try {
              await triggerAiStorefrontWorker({
                merchantId: merchant.id,
                source: 'onboarding',
              });
            } catch (error) {
              logger.error({
                message: 'AI storefront worker trigger failed',
                merchantId: merchant.id,
                error,
              });
            }
          });
        }
      }
    } catch (error) {
      logger.error({
        message: 'Template generation failed',
        merchantId: merchant.id,
        error,
      });
      throw error;
    }
    if (isEventPipelineEnqueueEnabled()) {
      try {
        await recordPlatformDomainEvent(adminSupabase, {
          deliveryData: { email },
          eventData: { business_name: businessName },
          eventName: 'platform.merchant_signup_completed.v1',
          eventTimestamp: new Date().toISOString(),
          eventType: 'merchant_signup_completed',
          externalEventId: `merchant_signup_completed:${merchant.id}`,
          merchantId: merchant.id,
          producer: 'worker',
          trustLevel: 'server',
        });
      } catch (error) {
        logger.error({
          message: 'Merchant signup completion enqueue failed',
          merchantId: merchant.id,
          error,
        });
      }
    }
    try {
      const { assignHeroImagesToMerchant } = await import(
        '@/services/hero-image-generator'
      );
      await assignHeroImagesToMerchant(
        merchant.id,
        persisted.businessType.toLowerCase(),
        false
      );
    } catch (error) {
      logger.error({
        message: 'Hero image assignment failed',
        merchantId: merchant.id,
        error,
      });
    }
    return {
      success: true,
      message: 'Store created!',
      businessName,
      merchantId: merchant.id,
    };
  } catch (error) {
    return { success: false, message: (error as Error).message };
  }
}
