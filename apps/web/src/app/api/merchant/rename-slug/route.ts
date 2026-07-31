import { after, type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getRootDomain } from '@/env';
import { authenticateApiRequest } from '@/lib/api-auth';
import {
  revalidateBlogFeed,
  revalidateDomains,
  revalidateMerchant,
  revalidateMerchantFeed,
  revalidateMerchantSlugLookup,
  revalidatePageConfig,
  revalidateStorefrontProductsSlugCache,
} from '@/lib/cache-revalidation';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  invalidateForwardDomainCacheForSlug,
  invalidateReverseDomainCacheForSlug,
} from '@/lib/domain-cache-simple';
import { triggerDomainEdgeConfigSync } from '@/lib/edge-config-sync';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { invalidateAliasCacheForSlug } from '@/lib/slug-alias-cache';
import { RESERVED_PATHS } from '@/lib/validation';
import { merchantIdParamSchema } from '@/schemas/merchant-id-param';
import { renameSlugSchema } from '@/schemas/rename-slug';

/**
 * POST /api/merchant/rename-slug
 *
 * Changes a merchant's storefront URL (slug). The heavy lifting — validation,
 * authorization, the atomic slug + domain + alias update — lives in the
 * `rename_merchant_slug` Postgres RPC (the only path allowed past the slug
 * immutability trigger). This route authenticates, enforces CSRF, calls the RPC,
 * maps its errors to HTTP, and busts the affected caches.
 */

// Postgres RPC MESSAGE -> HTTP status.
const RPC_ERROR_STATUS: Record<string, number> = {
  invalid_slug: 400,
  reserved_slug: 400,
  no_current_slug: 400,
  slug_taken: 409,
  forbidden: 403,
  not_authenticated: 401,
};

// Postgres RPC MESSAGE -> friendly client message.
const RPC_ERROR_MESSAGE: Record<string, string> = {
  invalid_slug: 'Use only lowercase letters, numbers, and hyphens.',
  reserved_slug: 'That URL is reserved. Please choose another.',
  no_current_slug: 'This store does not have a URL to change yet.',
  slug_taken: 'That store URL is already taken.',
  forbidden: 'You do not have permission to change this store URL.',
  not_authenticated: 'Unauthorized',
};

export async function POST(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (auth.error || !auth.user || !auth.supabase) {
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  }

  const { valid, response } = await checkCsrfProtection(request);
  if (!valid) {
    return (
      response ??
      NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const parsed = renameSlugSchema
    .extend({ merchantId: merchantIdParamSchema })
    .safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: z.flattenError(parsed.error) },
      { status: 400 }
    );
  }

  const { merchantId, new_slug: requestedSlug } = parsed.data;
  const merchantContext = await getMerchantForApiRequest(
    auth.supabase,
    auth.user.id,
    { requestedMerchantId: merchantId }
  );
  if (!merchantContext || merchantContext.merchantId !== merchantId) {
    return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
  }

  // Mirror check_staff_permission (the DB helper rename_merchant_slug itself
  // calls) exactly for (resource='settings', action='edit'), so the route never
  // 403s a staff member the RPC would allow.
  const access = toUserAccess(merchantContext);
  const perms = access.permissions;
  const canRename =
    access.isOwner ||
    perms['*']?.['*'] === true ||
    perms['*']?.edit === true ||
    perms.settings?.['*'] === true ||
    perms.settings?.edit === true ||
    perms.settings?.all === true ||
    perms.full_access?.all === true;
  if (!canRename) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const newSlug = requestedSlug.toLowerCase();

  // Reject storefront route words (wallet, product, orders, ...) up-front with a
  // friendly message. These are valid slug SHAPES but the storefront layout /
  // merchant resolvers reject them (isValidMerchantIdentifier/RESERVED_PATHS), so
  // renaming to one would serve Store Not Found. The RPC's v_reserved is the
  // authoritative backstop; this keeps the two in sync via the shared JS set.
  if (RESERVED_PATHS.has(newSlug)) {
    return NextResponse.json(
      { error: RPC_ERROR_MESSAGE.reserved_slug, code: 'reserved_slug' },
      { status: 400 }
    );
  }

  // Capture the current slug BEFORE the rename so we can bust the by-slug lookup
  // cache for BOTH the old and the new slug afterwards (see below).
  const { data: currentMerchant } = await auth.supabase
    .from('merchants')
    .select('slug')
    .eq('id', access.merchantId)
    .maybeSingle();
  const previousSlug =
    typeof currentMerchant?.slug === 'string' ? currentMerchant.slug : null;

  const { data, error } = await auth.supabase.rpc('rename_merchant_slug', {
    p_merchant_id: access.merchantId,
    p_new_slug: newSlug,
  });

  if (error) {
    const key = (error.message ?? '').trim();
    const status = RPC_ERROR_STATUS[key] ?? 500;
    const message = RPC_ERROR_MESSAGE[key] ?? 'Failed to change store URL.';
    if (status === 500) {
      console.error('rename_merchant_slug failed:', error.message, error.code);
    }
    return NextResponse.json({ error: message, code: key }, { status });
  }

  // rename_merchant_slug returns { slug, retired_slug }. Prefer retired_slug — the
  // slug the RPC ACTUALLY retired under its row lock — over our pre-RPC read, which
  // can be stale if a concurrent rename of the same store interleaved (A->B then
  // A->C both read 'A', but the second call really retires 'B'). Falls back to the
  // pre-RPC read for a no-op or an unexpected shape.
  const renameResult =
    data && typeof data === 'object'
      ? (data as { slug?: unknown; retired_slug?: unknown })
      : null;
  const finalSlug =
    typeof renameResult?.slug === 'string' ? renameResult.slug : newSlug;
  const retiredSlug =
    typeof renameResult?.retired_slug === 'string'
      ? renameResult.retired_slug
      : previousSlug;
  const rootDomain = getRootDomain() || 'usebaci.com';

  // The slug backs merchant cache keys, the domain rows, page configs, and the
  // product/OpenAI feeds (which embed absolute slug URLs). Bust all of them so
  // the new URL serves and the old one stops resolving to a live store (it now
  // 301s via the alias).
  revalidateMerchant(access.merchantId, finalSlug);
  revalidateDomains();
  revalidatePageConfig(access.merchantId);
  revalidateMerchantFeed(access.merchantId);
  // The blog RSS feed caches its payload (including slug-bearing store/feed URLs)
  // by merchant id under generic tags — bust it so the retired slug stops appearing.
  revalidateBlogFeed();
  // The /api/merchants/by-slug lookup caches under `merchant-slug-${slug}` +
  // 'merchant' (tags revalidateMerchant does NOT clear). Bust BOTH the retired
  // slug (so it stops resolving to a live store) and the new slug (so it serves
  // immediately) instead of leaving them cached for up to 5 minutes.
  if (retiredSlug && retiredSlug !== finalSlug) {
    revalidateMerchantSlugLookup(retiredSlug);
    // Drop this instance's reverse domain->slug cache entries pointing at the
    // retired slug so a custom domain stops resolving to it immediately. Other
    // instances self-correct via the proxy's alias-aware custom-domain fallback.
    invalidateReverseDomainCacheForSlug(retiredSlug);
    // Drop the stale forward slug->custom-domain entry for the retired slug too.
    invalidateForwardDomainCacheForSlug(retiredSlug);
    // Drop the stale NEGATIVE alias-cache entry for the just-retired slug so the
    // old host starts 301ing immediately instead of after NEGATIVE_TTL.
    invalidateAliasCacheForSlug(retiredSlug);
  }
  revalidateMerchantSlugLookup(finalSlug);
  // The /api/storefront/[slug]/products lookup caches (miss included) under the
  // generic 'merchant-slug' tag for 60s. If the NEW slug was probed just before
  // the rename, that cached miss would 404 the renamed store's products API; bust
  // the tag so it re-resolves immediately.
  revalidateStorefrontProductsSlugCache();
  // The forward slug->custom-domain cache can hold a NEGATIVE result for the new
  // slug (probed before it went live), which would stop the new subdomain 301ing
  // to the merchant's custom domain until CACHE_TTL. Drop it for the final slug.
  invalidateForwardDomainCacheForSlug(finalSlug);
  invalidateAliasCacheForSlug(finalSlug);

  // Custom-domain merchants: the RPC's subdomain-row move fires the domains
  // webhook, but explicitly resync Vercel Edge Config as a backstop so the
  // custom domain's `domain_* -> slug` mapping points at the NEW slug — otherwise
  // it keeps routing the custom domain to the retired slug and 404s. Best-effort,
  // runs after the response is sent, never throws.
  after(() => triggerDomainEdgeConfigSync());

  return NextResponse.json({
    slug: finalSlug,
    url: `https://${finalSlug}.${rootDomain}`,
  });
}
