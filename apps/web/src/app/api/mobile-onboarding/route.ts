import {
  createClient as createSupabaseClient,
  type User,
} from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { after, type NextRequest, NextResponse } from 'next/server';
import { env, getSupabaseAnonKey, getSupabaseUrl } from '@/env';
import { getCountryByCode } from '@/lib/countries';
import { normalizeBusinessName } from '@/lib/normalize-business-name';
import { checkPasswordBreach } from '@/lib/password-breach';
import { resolveMerchantIdBySlugOrAlias } from '@/lib/resolve-merchant-by-slug';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { isReservedMerchantSlug } from '@/lib/validation';
import { mobileOnboardingSchema } from '@/schemas/onboarding';
import type { BrandColors } from '@/types';
import { logOnboardingFailure } from './onboarding-failure-log';
import { buildOnboardingFailureResponse } from './onboarding-failure-response';

// Allow up to 60s — template generation calls an AI model (Gemini)
// and hero-image assignment can also be slow. The default 10s is not enough.
export const maxDuration = 60;

const MOBILE_ONBOARDING_OWNER_PROFILE_STAFF_ROLE = 'admin';

type SlugResolverClient = {
  rpc: (
    fn: string,
    params: { text_input: string }
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};

function hasEstablishedMerchantSlug(slug: string | null | undefined): boolean {
  return typeof slug === 'string' && slug.trim().length > 0;
}

async function resolveMerchantSlug(
  supabase: SlugResolverClient,
  textInput: string,
  fallbackSlug: string
): Promise<string> {
  const { data, error } = await supabase.rpc('generate_slug', {
    text_input: textInput,
  });

  if (error) {
    console.warn(
      'Failed to generate unique merchant slug for mobile onboarding',
      {
        error,
        fallbackSlug,
        textInput,
      }
    );
    return fallbackSlug;
  }

  return typeof data === 'string' && data.trim() ? data : fallbackSlug;
}

// CSRF exempt: This endpoint is called exclusively by the mobile app (Expo/React Native)
// which sends Authorization Bearer tokens, not browser cookies. CSRF is a browser-specific
// attack vector that exploits automatic cookie sending — mobile apps are not vulnerable.
export async function POST(req: NextRequest) {
  // Signup is not atomic: the auth user is created before the merchant row. If
  // provisioning throws after this flips, the caller owns an account with no
  // store and must be told to SIGN IN rather than retry registration (a retry
  // re-runs the same failing path and, once the signup session is cached, no
  // longer even reaches the "account exists" 409).
  let accountCreated = false;

  try {
    const body = await req.json();

    // --- 1. Validation ---
    const validationResult = await mobileOnboardingSchema.safeParseAsync(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: `Validation failed: ${validationResult.error.issues.map((e) => e.message).join(', ')}`,
        },
        { status: 400 }
      );
    }

    const {
      email,
      password,
      businessName: rawBusinessName,
      businessType,
      otherBusinessType,
      country,
      logoUrl,
      slug: providedSlug,
      slugIsCustom,
      brandColors: brandColorsString,
      firstName,
      lastName,
      phone,
    } = validationResult.data;
    const hasProvidedSlug =
      typeof providedSlug === 'string' && providedSlug.trim().length > 0;
    // NEW-MERCHANT (signup) path: a provided slug is EXPLICIT unless flagged
    // auto-derived (slugIsCustom === false). Newer clients send false for the UI's
    // prefilled value (a de-dupable PREFERENCE run through generate_slug) and true
    // when edited. LEGACY clients (pre-flag) had an editable Store Link and send only
    // `slug` with the flag OMITTED — so an omitted flag defaults to explicit here to
    // avoid signing up an auth user and then silently provisioning `chosen-1` on a
    // collision (which would strand that user on a URL they never chose).
    const isExplicitSlug = slugIsCustom !== false && hasProvidedSlug;
    // EXISTING-MERCHANT (profile completion) path: no signup happens, so there's no
    // auth user to orphan. Preserve the ORIGINAL auto-de-dup behavior for LEGACY
    // (omitted-flag) requests — those clients also auto-filled `slug` on completion —
    // by honoring ONLY an explicit slugIsCustom === true verbatim. An omitted flag
    // de-dupes via generate_slug as it did before slugIsCustom existed.
    const isExplicitSlugForCompletion =
      slugIsCustom === true && hasProvidedSlug;
    // Normalize once at entry so the name baked into page_configs matches what the
    // aa_normalize_merchant_business_name trigger stores in merchants.business_name.
    const businessName = normalizeBusinessName(rawBusinessName);

    // Combine first and last name for Supabase user metadata
    const fullName =
      [firstName, lastName].filter(Boolean).join(' ') || undefined;

    // Parse brand colors
    let brandColors: BrandColors | null = null;
    if (brandColorsString) {
      try {
        brandColors = JSON.parse(brandColorsString);
      } catch {
        console.error('Failed to parse brand colors from request body');
      }
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    let scopedSupabase = supabase;

    // --- 2. User Creation / Auth ---

    // Check if request is authenticated (Bearer token or Cookie)
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    let user: User | null = currentUser;

    // If no authenticated user, try to Sign Up
    if (!user) {
      if (!password) {
        return NextResponse.json(
          { error: 'Password is required for new accounts.' },
          { status: 400 }
        );
      }

      try {
        const { isBreached, count } = await checkPasswordBreach(password);

        if (isBreached) {
          return NextResponse.json(
            {
              error: `This password has appeared in ${(count ?? 1).toLocaleString()} known data breaches. Please choose a different, more secure password.`,
            },
            { status: 400 }
          );
        }
      } catch (breachCheckError) {
        // Fail-open: allow signup if breach check is unavailable
        console.error(
          'Password breach check failed, proceeding with signup:',
          breachCheckError
        );
      }

      // Preflight an EXPLICITLY-chosen Store Link BEFORE creating the auth user.
      // A collision would otherwise orphan the just-created signup: the merchant
      // 409 is returned after signUp, the client doesn't persist that session, and
      // the retry then hits the generic "account exists" path. Auto-generated
      // slugs skip this — generate_slug avoids collisions. (Rare TOCTOU races are
      // still caught by the post-insert 409.)
      if (isExplicitSlug && typeof providedSlug === 'string') {
        const normalizedSlug = providedSlug.trim().toLowerCase();
        // 63 = DNS label limit; a longer subdomain is unroutable and the DB trigger
        // rejects it (23505). Reject an EXPLICIT over-length slug HERE, before signUp,
        // so it fails validation instead of orphaning a just-created auth user. Only
        // the signup path enforces this — completion de-dupes/caps via generate_slug,
        // and the shared Zod schema can't tell signup from completion.
        if (normalizedSlug.length > 63) {
          return NextResponse.json(
            {
              error: 'That store URL is too long. Please choose a shorter one.',
              code: 'slug_unavailable',
            },
            { status: 409 }
          );
        }
        // Reserved storefront-route words (e.g. 'staff', 'wallet') AND infra
        // subdomains (e.g. 'www', 'app', 'mail') can be inserted but never resolve —
        // the proxy and merchant resolvers treat them as platform routes/hosts and
        // serve "Store Not Found". The DB reserved guard (is_reserved_merchant_slug)
        // also raises 23505 on insert; reject an EXPLICIT reserved choice here,
        // BEFORE signUp, so it doesn't orphan a just-created auth user. Mirrors the
        // full DB list, not just RESERVED_PATHS.
        if (isReservedMerchantSlug(normalizedSlug)) {
          return NextResponse.json(
            {
              error: 'That store URL is unavailable. Please choose another.',
              code: 'slug_unavailable',
            },
            { status: 409 }
          );
        }
        const preflight = await resolveMerchantIdBySlugOrAlias(
          supabase,
          normalizedSlug
        );
        // Fail CLOSED on a transient lookup error: proceeding would create the
        // auth user, then a taken slug would 409 after signup — the exact orphan
        // this preflight prevents.
        if (preflight.error) {
          console.error('Slug preflight lookup failed:', preflight.error);
          return NextResponse.json(
            {
              error:
                'Could not verify store URL availability. Please try again.',
            },
            { status: 503 }
          );
        }
        if (preflight.merchantId) {
          return NextResponse.json(
            {
              error: 'That store URL is unavailable. Please choose another.',
              code: 'slug_unavailable',
            },
            { status: 409 }
          );
        }
      }

      const { data: signUpData, error: signUpError } =
        await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          return NextResponse.json(
            { error: 'User already exists. Please log in.' },
            { status: 409 }
          );
        }
        if (
          signUpError.status === 429 ||
          signUpError.message.includes('security purposes')
        ) {
          return NextResponse.json(
            { error: 'Too many attempts. Please wait a minute and try again.' },
            { status: 429 }
          );
        }
        throw signUpError;
      }

      if (!signUpData.user) {
        return NextResponse.json(
          { error: 'Signup failed. Please try again.' },
          { status: 500 }
        );
      }
      user = signUpData.user;
      accountCreated = true;

      if (signUpData.session?.access_token) {
        // NOTE: We must construct a raw client here because the new user has
        // no cookie session yet. We inject their access_token as a Bearer
        // header so subsequent DB operations run under their RLS identity.
        scopedSupabase = createSupabaseClient(
          getSupabaseUrl(),
          getSupabaseAnonKey(),
          {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
              detectSessionInUrl: false,
            },
            global: {
              headers: {
                Authorization: `Bearer ${signUpData.session.access_token}`,
              },
            },
          }
        );
      } else {
        return NextResponse.json(
          {
            error:
              'Please confirm your email to finish onboarding and sign in again.',
            code: 'EMAIL_CONFIRMATION_REQUIRED',
          },
          { status: 403 }
        );
      }
    }

    // --- 3. Merchant & Domain Creation ---
    const finalBusinessType =
      businessType === 'other'
        ? otherBusinessType || businessType
        : businessType;
    const payoutCurrency = getCountryByCode(country)?.currency ?? 'USD';

    // Use provided slug or generate from business name (first word only)
    const slug =
      providedSlug ||
      businessName
        .split(' ')[0]
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') ||
      'store';
    const userAgent = req.headers.get('user-agent')?.toLowerCase() ?? '';
    const signupSource =
      userAgent.includes('iphone') ||
      userAgent.includes('ipad') ||
      userAgent.includes('ios')
        ? ('ios' as const)
        : ('android' as const);

    // Check for existing merchant
    const { data: existingMerchant, error: lookupError } = await scopedSupabase
      .from('merchants')
      .select('id, business_name, slug')
      .eq('user_id', user.id)
      .maybeSingle();

    if (lookupError) {
      // Reachable AFTER signUp, so it can strand a just-created account just
      // like a thrown error. Same recovery contract.
      return buildOnboardingFailureResponse(lookupError, {
        accountCreated,
        message: 'Failed to check existing account.',
      });
    }

    let merchantId: string;
    let merchantSlug: string;

    if (existingMerchant) {
      // Established slug: never re-slug on profile completion (that's the rename
      // flow's job). Otherwise fill the slug: an EXPLICIT choice (isExplicitSlugFor-
      // Completion — only slugIsCustom === true, so legacy omitted-flag auto slugs
      // keep the original de-dup behavior) is honored VERBATIM (a collision then
      // 23505s -> 409 slug_unavailable below); an AUTO slug is run through the
      // reserved/alias-aware generate_slug so it lands on a resolvable address.
      const resolvedSlug = hasEstablishedMerchantSlug(existingMerchant.slug)
        ? null
        : isExplicitSlugForCompletion
          ? slug
          : await resolveMerchantSlug(scopedSupabase, slug, slug);

      const merchantUpdate = {
        email,
        business_name: businessName,
        business_type: finalBusinessType,
        country,
        payout_currency: payoutCurrency,
        logo_url: logoUrl,
        favicon_png_192_url: logoUrl,
        brand_colors: brandColors,
        template_id: 'puck',
        ...(resolvedSlug ? { slug: resolvedSlug } : {}),
        ...(!existingMerchant.business_name?.trim()
          ? { signup_source: signupSource }
          : {}),
      };

      // Update existing
      const { data: updatedMerchant, error: updateError } = await scopedSupabase
        .from('merchants')
        .update(merchantUpdate)
        .eq('id', existingMerchant.id)
        .select('id, slug')
        .single();
      if (updateError) {
        // 23505 = slug already taken by a live merchant OR retired by another
        // merchant (prevent_merchant_slug_alias_collision). Surface a clean 409
        // instead of a generic 500.
        if (updateError.code === '23505') {
          return NextResponse.json(
            {
              error: 'That store URL is unavailable. Please choose another.',
              // Distinct from the "account already exists" 409 so the mobile
              // client shows a "choose another URL" action, not "go to login".
              code: 'slug_unavailable',
            },
            { status: 409 }
          );
        }
        throw updateError;
      }
      merchantId = updatedMerchant.id;
      merchantSlug = updatedMerchant.slug;
    } else {
      // Create new. When the slug was AUTO-derived (the user didn't edit the Store
      // Link — the UI's prefilled value is sent as a preference), a 23505 (slug
      // taken by a live merchant OR retired as another merchant's alias) must NOT
      // dead-end at a 409 for a URL the user never chose: retry ONCE with an
      // alias-aware generate_slug()-resolved slug. The first insert still uses the
      // provided (displayed) slug, so what the user SAW is provisioned when free.
      // An EXPLICITLY chosen slug (slugIsCustom) is respected exactly and 409s on
      // collision — never silently provisioned as a different address.
      const insertNewMerchant = (merchantSlugValue: string) =>
        scopedSupabase
          .from('merchants')
          .insert({
            user_id: user.id,
            email,
            business_name: businessName,
            business_type: finalBusinessType,
            country,
            payout_currency: payoutCurrency,
            logo_url: logoUrl,
            favicon_png_192_url: logoUrl,
            brand_colors: brandColors,
            slug: merchantSlugValue,
            template_id: 'puck',
            signup_source: signupSource,
          })
          .select('id, slug')
          .single();

      const created = await (async () => {
        const first = await insertNewMerchant(slug);
        // Explicit user choice, or a non-collision error: don't retry.
        if (first.error?.code !== '23505' || isExplicitSlug) {
          return first;
        }
        const retrySlug = await resolveMerchantSlug(scopedSupabase, slug, slug);
        // If generate_slug couldn't produce a different slug (RPC error fell back
        // to the same value), don't re-insert the same colliding slug.
        return retrySlug === slug ? first : insertNewMerchant(retrySlug);
      })();

      if (created.error) {
        if (created.error.code === '23505') {
          return NextResponse.json(
            {
              error: 'That store URL is unavailable. Please choose another.',
              // Distinct from the "account already exists" 409 so the mobile
              // client shows a "choose another URL" action, not "go to login".
              code: 'slug_unavailable',
            },
            { status: 409 }
          );
        }
        throw created.error;
      }
      if (!created.data) {
        throw new Error('Merchant creation returned no row');
      }
      merchantId = created.data.id;
      merchantSlug = created.data.slug;
    }

    // Create Domain
    const { error: domainError } = await scopedSupabase.from('domains').insert({
      merchant_id: merchantId,
      domain: `${merchantSlug}.${env.NEXT_PUBLIC_ROOT_DOMAIN}`,
      tld: `.${env.NEXT_PUBLIC_ROOT_DOMAIN}`,
      domain_type: 'subdomain',
      status: 'active',
      is_primary: true,
    });

    // 23505 = already provisioned. Any OTHER failure must NOT abort the request:
    // the merchant row is already committed, so returning here would leave the
    // account half-provisioned (no staff profile, no page config) AND
    // unrepairable — after signing in, (auth)/_layout sends a user who HAS a
    // merchant straight to the dashboard, never back through this endpoint. The
    // address is derivable from the merchant, so hand the repair to after()
    // instead and let provisioning finish.
    const needsDomainRepair = Boolean(
      domainError && domainError.code !== '23505'
    );
    if (needsDomainRepair) {
      logOnboardingFailure(domainError, {
        stage: 'domain_provisioning',
        merchantId,
      });
    }

    // Upsert Staff Member (Profile Data)
    const { error: staffError } = await scopedSupabase
      .from('staff_members')
      .upsert(
        {
          user_id: user.id,
          merchant_id: merchantId,
          name: fullName || null,
          phone: phone || null,
          email: user.email || email,
          role: MOBILE_ONBOARDING_OWNER_PROFILE_STAFF_ROLE,
          status: 'active',
        },
        { onConflict: 'user_id,merchant_id' }
      );
    if (staffError) {
      console.error('Failed to create/update staff member profile', staffError);
    }

    // --- 4. Template & Assets (deferred via after()) ---
    // These are slow operations (AI model call for template + image assignment)
    // that must NOT block the registration response. after() runs them after
    // the response is sent while keeping the function alive on Vercel.
    after(async () => {
      // Use admin client for background writes — the scoped client's Bearer
      // token may expire, and after() runs outside the original auth context.
      const adminSupabase = createAdminClient();

      // Repair the storefront address if the scoped insert above failed. The
      // merchant row is committed and the address is derived from it, so this
      // needs no user action — and the user could not retry it anyway, since
      // sign-in routes a merchant-owning user straight to the dashboard.
      if (needsDomainRepair) {
        const { error: repairError } = await adminSupabase
          .from('domains')
          .insert({
            merchant_id: merchantId,
            domain: `${merchantSlug}.${env.NEXT_PUBLIC_ROOT_DOMAIN}`,
            tld: `.${env.NEXT_PUBLIC_ROOT_DOMAIN}`,
            domain_type: 'subdomain',
            status: 'active',
            is_primary: true,
          });
        if (repairError && repairError.code !== '23505') {
          logOnboardingFailure(repairError, {
            stage: 'domain_repair',
            merchantId,
          });
        }
      }

      // Generate Template
      try {
        const { generateInitialTemplate } = await import(
          '@/lib/initial-template-generator'
        );
        const safeBrandColors = brandColors || {
          primary: '#000000',
          background: '#ffffff',
          accent: '#F59E0B',
        };
        const config = await generateInitialTemplate({
          businessName,
          businessType: finalBusinessType,
          brandColors: safeBrandColors,
          merchant: { id: merchantId, slug: merchantSlug },
        });
        const { error: pageConfigError } = await adminSupabase
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
          console.error(
            'Failed to insert page config for merchant',
            merchantId,
            pageConfigError
          );
        }
      } catch (e) {
        console.error('Template generation failed for merchant', merchantId, e);
      }

      // Hero Images
      try {
        const { assignHeroImagesToMerchant } = await import(
          '@/services/hero-image-generator'
        );
        await assignHeroImagesToMerchant(
          merchantId,
          finalBusinessType.toLowerCase(),
          false
        );
      } catch (e) {
        console.error(
          'Hero image assignment failed for merchant',
          merchantId,
          e
        );
      }
    });

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email ?? email },
      merchant: { id: merchantId, slug: merchantSlug },
      message: 'Account created successfully',
    });
  } catch (error: unknown) {
    // Keeps the Postgres code (e.g. 42501) in the log and tells a caller whose
    // account already exists how to recover. See onboarding-failure-response.ts.
    return buildOnboardingFailureResponse(error, { accountCreated });
  }
}
