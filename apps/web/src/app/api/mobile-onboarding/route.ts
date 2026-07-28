import {
  createClient as createSupabaseClient,
  type User,
} from '@supabase/supabase-js';
import { after, type NextRequest, NextResponse } from 'next/server';
import { env, getSupabaseAnonKey, getSupabaseUrl } from '@/env';
import { getCountryByCode } from '@/lib/countries';
import { normalizeBusinessName } from '@/lib/normalize-business-name';
import { checkPasswordBreach } from '@/lib/password-breach';
import { resolveMerchantIdBySlugOrAlias } from '@/lib/resolve-merchant-by-slug';
import { createAdminClient } from '@/lib/supabase/admin';
import { isReservedMerchantSlug } from '@/lib/validation';
import { mobileOnboardingSchema } from '@/schemas/onboarding';
import type { BrandColors } from '@/types';
import { buildNumberedSlugCandidate } from './build-numbered-slug-candidate';
import { logOnboardingFailure } from './onboarding-failure-log';
import { buildOnboardingFailureResponse } from './onboarding-failure-response';
import { provisionMerchantDomain } from './provision-merchant-domain';
import { runDeferredOnboardingProvisioning } from './run-deferred-onboarding-provisioning';

// Allow up to 60s — template generation calls an AI model (Gemini)
// and hero-image assignment can also be slow. The default 10s is not enough.
export const maxDuration = 60;

const MOBILE_ONBOARDING_OWNER_PROFILE_STAFF_ROLE = 'admin';
const MAX_AUTO_SLUG_FALLBACK_ATTEMPTS = 20;

function createOnboardingClient(authorization: string | null) {
  return createSupabaseClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    ...(authorization
      ? { global: { headers: { Authorization: authorization } } }
      : {}),
  });
}

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
  // True only after this request creates a new auth account, so a later
  // provisioning failure can direct that signed-out caller to sign in and
  // finish setup. Bearer-authenticated profile completion already owns a client
  // session and should receive the ordinary failure contract.
  let accountExists = false;

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

    // Mobile registration and profile completion must never inherit browser or
    // stale native-cookie identity. Anonymous registration gets a cookie-free
    // anon client; authenticated completion is scoped exclusively to the app's
    // explicit Bearer token.
    const authorizationHeader = req.headers.get('authorization');
    const bearerAuthorization = /^Bearer\s+\S+$/i.test(
      authorizationHeader ?? ''
    )
      ? authorizationHeader
      : null;
    const supabase = createOnboardingClient(bearerAuthorization);
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
      accountExists = true;

      if (signUpData.session?.access_token) {
        // NOTE: We must construct a raw client here because the new user has
        // no client session yet. We inject their access_token as a Bearer
        // header so subsequent DB operations run under their RLS identity.
        scopedSupabase = createOnboardingClient(
          `Bearer ${signUpData.session.access_token}`
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
        accountExists,
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
        let candidateResult = await insertNewMerchant(slug);
        // Explicit user choice, or a non-collision error: don't retry.
        if (candidateResult.error?.code !== '23505' || isExplicitSlug) {
          return candidateResult;
        }

        const generatedSlug = await resolveMerchantSlug(
          scopedSupabase,
          slug,
          slug
        );
        if (generatedSlug !== slug) {
          candidateResult = await insertNewMerchant(generatedSlug);
          if (candidateResult.error?.code !== '23505') {
            return candidateResult;
          }
        }

        // generate_slug() runs under caller RLS. A retired alias or hidden
        // platform slug can therefore collide at the trigger while remaining
        // invisible to the RPC, which returns the same failed slug. Probe a
        // bounded sequence of DNS-safe suffixes through the write boundary so
        // an autogenerated choice never strands the newly created auth account.
        for (
          let suffix = 1;
          suffix <= MAX_AUTO_SLUG_FALLBACK_ATTEMPTS;
          suffix += 1
        ) {
          const numberedSlug = buildNumberedSlugCandidate(slug, suffix);
          if (numberedSlug === generatedSlug) {
            continue;
          }
          candidateResult = await insertNewMerchant(numberedSlug);
          if (candidateResult.error?.code !== '23505') {
            return candidateResult;
          }
        }

        return candidateResult;
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

    // A failure here must NOT abort the request: the merchant row is already
    // committed, so returning would leave the account half-provisioned (no
    // staff profile, no page config) AND unrepairable — after signing in,
    // (auth)/_layout sends a user who HAS a merchant straight to the dashboard,
    // never back through this endpoint.
    const domainProvisionInput = {
      merchantId,
      merchantSlug,
      rootDomain: env.NEXT_PUBLIC_ROOT_DOMAIN,
    };
    const firstDomainAttempt = await provisionMerchantDomain(
      scopedSupabase,
      domainProvisionInput
    );
    if (!firstDomainAttempt.provisioned) {
      logOnboardingFailure(firstDomainAttempt.error, {
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
    after(() =>
      runDeferredOnboardingProvisioning({
        // Defined HERE, not handed over as a client: route.ts is the module
        // the boundary contract authorizes, so the privileged capability is
        // bounded to exactly this one write and cannot be repurposed.
        publishHomePage: (config) =>
          createAdminClient().from('page_configs').insert({
            merchant_id: merchantId,
            page_slug: 'home',
            page_name: 'Home',
            draft_config: config,
            published_config: config,
            is_published: true,
          }),
        merchantId,
        merchantSlug,
        businessName,
        businessType: finalBusinessType,
        brandColors,
        // Only set when the in-request insert failed; carries the SAME scoped
        // client so a real denial stays a denial.
        domainRepair: firstDomainAttempt.provisioned
          ? null
          : { client: scopedSupabase, input: domainProvisionInput },
      })
    );

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email ?? email },
      merchant: { id: merchantId, slug: merchantSlug },
      message: 'Account created successfully',
    });
  } catch (error: unknown) {
    // Keeps the Postgres code (e.g. 42501) in the log and tells a caller whose
    // account already exists how to recover. See onboarding-failure-response.ts.
    return buildOnboardingFailureResponse(error, { accountExists });
  }
}
