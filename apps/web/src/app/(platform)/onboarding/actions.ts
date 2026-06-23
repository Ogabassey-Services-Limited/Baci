'use server';

import type { User } from '@supabase/supabase-js';
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
import { getCountryByCode } from '@/lib/countries';
import { sendWelcomeEmail } from '@/lib/email';
import { ensureActionRateLimit } from '@/lib/ensure-action-rate-limit';
import { logger } from '@/lib/logger';
import type { createAdminClient as createAdminClientFactory } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { parseBrandColors } from '@/schemas/brand-colors';
import { onboardingSchema } from '@/schemas/onboarding';
import { onboardingMagicLinkSchema } from '@/schemas/onboarding-magic-link';
import type { BrandColors } from '@/types';

const DEFAULT_BRAND_COLORS: BrandColors = {
  primary: '#000000',
  background: '#ffffff',
  accent: '#F59E0B',
};

function resolveStarterBrandColors(
  parsedBrandColors: BrandColors | null,
  merchant: { brand_colors?: unknown } | null
): BrandColors {
  if (parsedBrandColors) {
    return parsedBrandColors;
  }

  const persistedBrandColors = parseBrandColors(merchant?.brand_colors);
  if (persistedBrandColors) {
    return persistedBrandColors;
  }

  return DEFAULT_BRAND_COLORS;
}

export type ServerActionState = {
  message: string;
  success: boolean;
  businessName?: string;
  merchantId?: string;
  errors?: {
    fieldErrors: Record<string, string[] | undefined>;
  };
};

function buildOnboardingRedirectUrl(search: string = ''): string {
  const appUrl = getConfiguredAppUrl() ?? (isProduction() ? null : getAppUrl());

  if (!appUrl) {
    throw new Error('NEXT_PUBLIC_APP_URL must be configured');
  }

  const url = new URL('/onboarding', appUrl);
  url.search = search;
  return url.toString();
}

function buildMerchantSlug(businessName: string): string {
  return (
    businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'store'
  );
}

type SlugResolverClient = Pick<
  ReturnType<typeof createAdminClientFactory>,
  'rpc'
>;

async function resolveMerchantSlug(
  adminSupabase: SlugResolverClient,
  businessName: string
): Promise<string> {
  const fallbackSlug = buildMerchantSlug(businessName);
  const { data, error } = await adminSupabase.rpc('generate_slug', {
    text_input: businessName,
  });

  if (error) {
    logger.warn({
      message: 'Failed to generate unique merchant slug',
      businessName,
      error,
    });
    return fallbackSlug;
  }

  return typeof data === 'string' && data.trim() ? data : fallbackSlug;
}

function hasEstablishedMerchantSlug(slug: string | null | undefined): boolean {
  return typeof slug === 'string' && slug.trim().length > 0;
}

// eslint-disable-next-line react-doctor/server-auth-actions -- public-by-design: pre-auth onboarding submission; Zod-validated + identity/IP rate limited
export async function submitOnboarding(
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

  // Admin client for database inserts (Bypasses RLS)
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const adminSupabase = createAdminClient();

  let user: User | null = null;
  const rawFormData = Object.fromEntries(formData.entries());
  logger.info({ message: 'submitOnboarding started' });

  // Validation
  const validationResult = await onboardingSchema.safeParseAsync(rawFormData);
  if (!validationResult.success) {
    return {
      success: false,
      message: `Form is incomplete: ${validationResult.error.issues.map((e) => e.message).join(', ')}`,
      errors: validationResult.error.flatten(),
    };
  }

  const {
    email,
    password,
    businessName,
    businessType,
    otherBusinessType,
    country,
    logoUrl,
    brandColors: brandColorsString,
  } = validationResult.data;
  const payoutCurrency = getCountryByCode(country)?.currency ?? 'USD';

  // Parse brand colors defensively. On a malformed JSON payload we MUST NOT
  // write `brand_colors: null` — a re-run of onboarding on a stub merchant
  // would then wipe a real, already-persisted palette (drift vector V5).
  // `brandColorsParsed` tracks whether parsing succeeded so the write below can
  // conditionally spread the column only on success (mirrors the existing
  // conditional-slug pattern).
  let brandColors: BrandColors | null = null;
  let brandColorsParsed = false;
  if (brandColorsString) {
    try {
      const parsed: unknown = JSON.parse(brandColorsString);
      brandColors = parseBrandColors(parsed);
      brandColorsParsed = brandColors !== null;
      if (!brandColorsParsed) {
        logger.error({ message: 'Parsed brand colors invalid format' });
      }
    } catch (e) {
      logger.error({ message: 'Failed to parse brand colors', error: e });
    }
  }

  try {
    // PRE-CHECK: Only block if email has a COMPLETED merchant (with business_name set)
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

    // 1. Auth Check (Using standard client)
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    const onboardingRedirectUrl = buildOnboardingRedirectUrl();

    if (authUser) {
      // Check if form email matches session email
      if (authUser.email?.toLowerCase() === email.toLowerCase()) {
        // Same email - use existing session
        user = authUser;
      } else if (password) {
        // Different email with password provided - sign out old session and create new account
        await supabase.auth.signOut();

        // Try to sign up with the new email
        const { data: signUpData, error: signUpError } =
          await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: onboardingRedirectUrl,
            },
          });

        if (signUpError) throw signUpError;

        if (signUpData.session) {
          user = signUpData.user;
          sendWelcomeEmail(email, businessName || 'Valued Merchant').catch(
            (err) =>
              logger.error({
                message: 'Failed to send welcome email',
                email,
                error: err,
              })
          );
        } else {
          throw new Error(
            'Please disable "Confirm Email" in Supabase settings.'
          );
        }
      } else {
        // Different email but no password - ask user to provide password
        return {
          success: false,
          message: `You are logged in as ${authUser.email}. Please log out first, or enter a password to create a new account with ${email}.`,
        };
      }
    } else if (password) {
      // No session - try SignIn then SignUp
      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({ email, password });

      if (!signInError) {
        user = signInData.user;
      } else if (signInError.message.includes('Invalid login credentials')) {
        // SignUp
        const { data: signUpData, error: signUpError } =
          await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: onboardingRedirectUrl,
            },
          });

        if (signUpError) throw signUpError;

        if (signUpData.session) {
          user = signUpData.user;
          sendWelcomeEmail(email, businessName || 'Valued Merchant').catch(
            (err) =>
              logger.error({
                message: 'Failed to send welcome email',
                email,
                error: err,
              })
          );
        } else {
          throw new Error(
            'Please disable "Confirm Email" in Supabase settings.'
          );
        }
      } else {
        throw signInError;
      }
    }

    if (!user) throw new Error('Authentication failed.');

    // 2. Insert Data (Using ADMIN CLIENT)
    const finalBusinessType =
      businessType === 'other'
        ? otherBusinessType || businessType
        : businessType;
    // Check for existing merchant record
    const { data: existing } = await adminSupabase
      .from('merchants')
      .select('id, business_name, slug')
      .eq('user_id', user.id)
      .maybeSingle();

    let merchant: { id: string; slug?: string; brand_colors?: unknown } | null;

    if (existing) {
      if (existing.business_name) {
        // Merchant already fully set up - redirect to dashboard
        return {
          success: true,
          message: 'Welcome back! Redirecting to your dashboard...',
          businessName: existing.business_name,
          merchantId: existing.id,
        };
      }

      const resolvedSlug = hasEstablishedMerchantSlug(existing.slug)
        ? null
        : await resolveMerchantSlug(adminSupabase, businessName);

      // Incomplete merchant (from auto-trigger) - UPDATE with form data
      const { data: updatedMerchant, error: updateError } = await adminSupabase
        .from('merchants')
        .update({
          email,
          business_name: businessName,
          business_type: finalBusinessType,
          country,
          payout_currency: payoutCurrency,
          logo_url: logoUrl,
          // Sync logo to favicon for mobile app compatibility
          favicon_png_192_url: logoUrl,
          // Only write brand_colors when JSON.parse succeeded; a malformed
          // payload must not overwrite an existing palette with null (V5).
          ...(brandColorsParsed ? { brand_colors: brandColors } : {}),
          ...(resolvedSlug ? { slug: resolvedSlug } : {}),
        })
        .eq('id', existing.id)
        // Select the columns the starter generator reads downstream
        // (brand_colors preserves the stored palette via
        // resolveStarterBrandColors; hero_image_ids/logo_url feed the template).
        .select('id, slug, brand_colors, hero_image_ids, logo_url')
        .single();

      if (updateError)
        throw new Error(`Failed to update merchant: ${updateError.message}`);
      merchant = updatedMerchant;
    } else {
      const slug = await resolveMerchantSlug(adminSupabase, businessName);

      // No existing record - create new merchant
      const { data: newMerchant, error: createError } = await adminSupabase
        .from('merchants')
        .insert({
          user_id: user.id,
          email,
          business_name: businessName,
          business_type: finalBusinessType,
          country,
          payout_currency: payoutCurrency,
          logo_url: logoUrl,
          // Sync logo to favicon for mobile app compatibility
          favicon_png_192_url: logoUrl,
          // Only write brand_colors when JSON.parse succeeded; a malformed
          // payload must not persist a null palette (V5). Omitting the column
          // lets the table default apply instead.
          ...(brandColorsParsed ? { brand_colors: brandColors } : {}),
          slug,
          template_id: 'puck', // Force Builder Engine for new merchants
          signup_source: 'web',
        })
        // Select the columns the starter generator reads downstream
        // (brand_colors preserves the stored palette via
        // resolveStarterBrandColors; hero_image_ids/logo_url feed the template).
        .select('id, slug, brand_colors, hero_image_ids, logo_url')
        .single();

      if (createError)
        throw new Error(`Merchant creation failed: ${createError.message}`);
      merchant = newMerchant;
    }

    if (!merchant) throw new Error('Failed to create merchant record.');

    const rootDomain = getRootDomain() || 'usebaci.com';

    // Create Domain
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

    // Generate Template (simplified for brevity, import remains same)
    try {
      const { generateInitialTemplate } = await import(
        '@/lib/initial-template-generator'
      );
      // Ensure starter generation uses the same palette persisted on the merchant row.
      // If parsing failed while completing a stub merchant, brand_colors was intentionally
      // omitted above, so use the preserved row palette instead of falling back to defaults.
      const safeBrandColors = resolveStarterBrandColors(brandColors, merchant);
      const config = await generateInitialTemplate({
        businessName,
        businessType: finalBusinessType,
        brandColors: safeBrandColors,
        merchant,
      });
      const { data: insertedPageConfig, error: pageConfigInsertError } =
        await adminSupabase
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

      if (pageConfigInsertError || !insertedPageConfig) {
        throw new Error(
          `Failed to create starter page config: ${
            pageConfigInsertError?.message ?? 'No page config returned'
          }`
        );
      }

      if (isAiStorefrontGenerationEnabled()) {
        const idempotencyKey = `storefront-layout:${merchant.id}:home:onboarding`;
        const { error: aiJobError } = await adminSupabase
          .from('ai_jobs')
          .insert({
            merchant_id: merchant.id,
            type: 'storefront_layout_generation',
            status: 'pending',
            idempotency_key: idempotencyKey,
            input: {
              pageSlug: 'home',
              businessName,
              businessType: finalBusinessType,
              brandColors: safeBrandColors,
              createdPageConfigUpdatedAt: insertedPageConfig.updated_at,
            },
            model: getOllamaStorefrontModel(),
            metadata: {
              source: 'onboarding',
              createdPageConfigUpdatedAt: insertedPageConfig.updated_at,
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
    } catch (e) {
      logger.error({
        message: 'Template generation failed',
        merchantId: merchant.id,
        error: e,
      });
      throw e;
    }

    // Assign Hero Images
    try {
      const { assignHeroImagesToMerchant } = await import(
        '@/services/hero-image-generator'
      );
      // Pass false to skip synchronous generation - instant feedback for user
      await assignHeroImagesToMerchant(
        merchant.id,
        finalBusinessType.toLowerCase(),
        false
      );
    } catch (e) {
      logger.error({
        message: 'Hero image assignment failed',
        merchantId: merchant.id,
        error: e,
      });
    }

    return {
      success: true,
      message: 'Store created!',
      businessName,
      merchantId: merchant.id,
    };
  } catch (e) {
    return { success: false, message: (e as Error).message };
  }
}

// eslint-disable-next-line react-doctor/server-auth-actions -- public-by-design: login bootstrap cannot require a session; email Zod-validated + identity/IP rate limited to the middleware budget
export async function sendMagicLink(
  email: string
): Promise<{ success: boolean; message: string }> {
  const rateLimitAllowed = await ensureActionRateLimit('magic-link', {
    requests: 3,
    windowMs: 60_000,
  });
  if (!rateLimitAllowed) {
    return {
      success: false,
      message: 'Too many magic link requests. Please try again later.',
    };
  }
  if (!email) return { success: false, message: 'Email is required.' };
  const validationResult = onboardingMagicLinkSchema.safeParse({ email });
  if (!validationResult.success) {
    return {
      success: false,
      message:
        validationResult.error.issues[0]?.message ??
        'Please enter a valid email address.',
    };
  }
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { error } = await supabase.auth.signInWithOtp({
      email: validationResult.data.email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: buildOnboardingRedirectUrl('fromMagicLink=true'),
      },
    });
    if (error) {
      logger.warn({
        message: 'Onboarding magic link send failed',
        error,
      });
      return {
        success: false,
        message: 'Unable to send magic link. Please try again later.',
      };
    }
    return { success: true, message: 'Magic link sent! Check your email.' };
  } catch (e) {
    logger.warn({
      message: 'Onboarding magic link send threw',
      error: e,
    });
    return {
      success: false,
      message: 'Unable to send magic link. Please try again later.',
    };
  }
}
