import { NextResponse } from 'next/server';
import type { ZodError } from 'zod';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { getStorefrontPublicationCacheIdentity } from '@/lib/get-storefront-publication-cache-identity';
import { getAuthenticatedUser } from '@/lib/supabase/mobile-auth';

/**
 * Shared authorization for category management (B1-lite).
 *
 * PERMISSION CONTRACT — owner-only, deliberately.
 * `categories_merchant_insert/update/delete` are RLS-scoped to
 * `merchants.user_id = auth.uid()` with no staff branch, so owner-only is the
 * one choice that needs NO RLS widening and cannot diverge from the database.
 * The retirement plan explicitly forbids granting `settings:edit` merely so a
 * purge can run. To let permitted staff manage categories later, change
 * `isCategoryManager` AND the three RLS policies together — enforcing the same
 * rule at both boundaries is the whole point.
 */
export const CATEGORY_MANAGEMENT_RULE = 'owner-only' as const;

export interface CategoryRouteContext {
  merchantId: string;
  /** Storefront identifiers used to resolve purge hostnames server-side. */
  merchantIdentifiers: string[];
  /**
   * The CALLER's client — Bearer-scoped for mobile, cookie-scoped for web — so
   * RLS remains the final authority on every mutation.
   */
  supabase: NonNullable<
    Awaited<ReturnType<typeof getAuthenticatedUser>>
  >['supabase'];
}

export type CategoryRouteResolution =
  | { ok: true; context: CategoryRouteContext }
  | { ok: false; response: NextResponse };

function isCategoryManager(access: { isOwner?: boolean }): boolean {
  return access.isOwner === true;
}

/**
 * Authenticate and derive the merchant SERVER-SIDE.
 *
 * Deliberately takes NO body input: this runs before the request body is read,
 * so an unauthenticated caller can never reach CSRF handling, JSON parsing or
 * schema validation. Tenant selection is always session-derived — see
 * `assertRequestedMerchant` for the separate client-assertion check.
 */
export async function resolveCategoryRouteContext(
  request: Request
): Promise<CategoryRouteResolution> {
  // Supports BOTH transports: Bearer (mobile-admin) and cookie (web). The
  // mobile category mutation is the primary caller, so a cookie-only client
  // would 401 every mobile request. CSRF is separately exempt for Bearer.
  const auth = await getAuthenticatedUser(request);
  if (!auth?.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const { user, supabase } = auth;
  const merchantContext = await getMerchantForApiRequest(supabase, user.id);
  if (!merchantContext) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      ),
    };
  }

  if (!isCategoryManager(toUserAccess(merchantContext))) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Permission denied', code: 'CATEGORY_OWNER_ONLY' },
        { status: 403 }
      ),
    };
  }

  // Complete storefront identity — current slug, RETIRED slugs, and active
  // custom/purchased domains. Passing only the current slug silently resolves
  // to zero hostnames for a renamed merchant or one whose slug is legacy-null
  // but has a live custom domain, which would skip edge eviction entirely.
  const identity = await getStorefrontPublicationCacheIdentity(
    supabase,
    merchantContext.merchantId,
    merchantContext.merchantSlug
  );

  return {
    ok: true,
    context: {
      merchantId: merchantContext.merchantId,
      merchantIdentifiers: [...identity.identifiers],
      supabase,
    },
  };
}

/**
 * A parentId must belong to the SAME merchant.
 *
 * RLS only constrains the row being written and the FK only proves the parent
 * UUID exists, so without this an owner could parent their category under
 * another merchant's category — hiding it from their own top-level navigation
 * and coupling it to a foreign row's lifecycle.
 */
export async function isParentCategoryOwnedByMerchant(
  supabase: CategoryRouteContext['supabase'],
  merchantId: string,
  parentId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('categories')
    .select('id')
    .eq('id', parentId)
    .eq('merchant_id', merchantId)
    .maybeSingle();

  return Boolean(data);
}

/**
 * A client-supplied `merchantId` is an ASSERTION, never a selector. If it
 * disagrees with the session-derived tenant the request is refused outright
 * rather than silently rewritten to the caller's own merchant, so a mis-wired
 * client surfaces as a hard error instead of writing to the wrong store.
 *
 * Returns the refusal response, or null when the assertion holds (or is absent).
 */
export function assertRequestedMerchant(
  context: CategoryRouteContext,
  requestedMerchantId?: string
): NextResponse | null {
  if (requestedMerchantId && requestedMerchantId !== context.merchantId) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }
  return null;
}

/**
 * Turn a validation failure into a message the merchant can act on.
 *
 * mobile-admin derives the slug from the category NAME, so a category called
 * "Checkout" is rejected by the reserved-slug rule through no visible fault of
 * the merchant's. A bare "Invalid input" gives them nothing to correct, and
 * `details.fieldErrors` never reaches the toast — the client surfaces the
 * top-level `error` string only. The flattened details are still returned.
 */
export function firstValidationMessage(error: ZodError): string {
  return error.issues[0]?.message ?? 'Invalid input';
}
