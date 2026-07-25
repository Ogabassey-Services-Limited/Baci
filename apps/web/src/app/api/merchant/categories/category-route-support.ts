import { NextResponse } from 'next/server';
import type { ZodError } from 'zod';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { logger } from '@/lib/logger';
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

/** The authenticated caller, resolved before any body is read. */
export interface CategoryRequestAuth {
  userId: string;
  supabase: CategoryRouteContext['supabase'];
}

export type CategoryAuthResolution =
  | { ok: true; auth: CategoryRequestAuth }
  | { ok: false; response: NextResponse };

function isCategoryManager(access: { isOwner?: boolean }): boolean {
  return access.isOwner === true;
}

/**
 * Authenticate ONLY. Runs as the first statement of every handler, before CSRF
 * handling and before the body is read, so an unauthenticated caller can never
 * reach JSON parsing or schema validation.
 *
 * Supports BOTH transports: Bearer (mobile-admin) and cookie (web). The mobile
 * category mutation is the primary caller, so a cookie-only client would 401
 * every mobile request. CSRF is separately exempt for Bearer.
 */
export async function authenticateCategoryRequest(
  request: Request
): Promise<CategoryAuthResolution> {
  const auth = await getAuthenticatedUser(request);
  if (!auth?.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  return {
    ok: true,
    auth: { userId: auth.user.id, supabase: auth.supabase },
  };
}

/**
 * Resolve WHICH merchant this request acts on, then authorize it.
 *
 * `requestedMerchantId` selects among the merchants the CALLER already has
 * access to — `getMerchantForApiRequest` filters owned merchants by `user_id`
 * and staff rows by active membership, so an id the caller has no access to
 * resolves to nothing and 404s. It is never authority on its own.
 *
 * This matters for owners with several stores: the mobile context RPC picks the
 * lowest merchant UUID while the default here is the most recently created one.
 * Ignoring the assertion and 403ing on mismatch made category creation
 * impossible for whichever store the app was actually displaying.
 */
export async function resolveCategoryRouteContext(
  auth: CategoryRequestAuth,
  requestedMerchantId?: string
): Promise<CategoryRouteResolution> {
  const { supabase } = auth;
  const merchantContext = await getMerchantForApiRequest(
    supabase,
    auth.userId,
    {
      requestedMerchantId: requestedMerchantId ?? null,
    }
  );
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

  return {
    ok: true,
    context: {
      merchantId: merchantContext.merchantId,
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
export type ParentOwnershipResult =
  | 'owned'
  | 'absent'
  | 'retired'
  | 'lookup-failed';

export async function isParentCategoryOwnedByMerchant(
  supabase: CategoryRouteContext['supabase'],
  merchantId: string,
  parentId: string
): Promise<ParentOwnershipResult> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, is_active')
    .eq('id', parentId)
    .eq('merchant_id', merchantId)
    .maybeSingle<{ id: string; is_active: boolean | null }>();

  // A transient database failure also yields `data: null`. Reporting that as
  // absence would answer a non-retryable 400 PARENT_NOT_FOUND for a parent that
  // exists, so the two cases must stay distinguishable.
  if (error) {
    return 'lookup-failed';
  }
  if (!data) {
    return 'absent';
  }
  // A retired parent is a tombstone. Nesting an ACTIVE child under it leaves
  // the child servable but absent from navigation, which walks down from
  // `parent_id IS NULL` roots — the same orphaning DELETE goes out of its way
  // to prevent.
  return data.is_active === false ? 'retired' : 'owned';
}

/**
 * Promote a retired category's children to roots.
 *
 * Storefront navigation walks DOWN from `parent_id IS NULL`, so a child still
 * pointing at a deactivated parent is neither retired nor reachable — invisible
 * with no route back. Used by DELETE and by a PATCH that deactivates.
 *
 * Never throws: the parent is already retired by the time this runs, so raising
 * would misreport a committed mutation. Returns how many rows moved, or null
 * when the detach itself failed.
 */
export async function promoteChildrenToRoots(
  supabase: CategoryRouteContext['supabase'],
  merchantId: string,
  parentId: string,
  updatedAt: string
): Promise<number | null> {
  const { data, error } = await supabase
    .from('categories')
    .update({ parent_id: null, updated_at: updatedAt })
    .eq('merchant_id', merchantId)
    .eq('parent_id', parentId)
    .select('slug');

  if (error) {
    logger.error({
      message: 'Failed to detach children of a retired category',
      merchantId,
      categoryId: parentId,
      error: error.message,
    });
    return null;
  }
  return data?.length ?? 0;
}

/**
 * Depth bound for the ancestor walk.
 *
 * Real catalogues are two or three levels deep. The bound exists so a cycle
 * that ALREADY exists in the data cannot spin this loop forever — reaching it
 * is treated as "would create a cycle", i.e. fail closed.
 */
const MAX_CATEGORY_DEPTH = 32;

/**
 * Would re-parenting `categoryId` under `parentId` create a cycle?
 *
 * The foreign key happily accepts a self-reference or a longer loop, and
 * storefront navigation only selects `parent_id IS NULL` roots
 * (`lib/cached-categories.ts`), so a cycle silently detaches the whole branch
 * from the merchant's own navigation. Walk UP from the proposed parent: if we
 * reach the category being edited, the edge would close a loop.
 */
export async function wouldCreateCategoryCycle(
  supabase: CategoryRouteContext['supabase'],
  merchantId: string,
  categoryId: string,
  parentId: string
): Promise<boolean> {
  if (parentId === categoryId) {
    return true;
  }

  let cursor: string | null = parentId;
  const seen = new Set<string>([categoryId]);

  for (let depth = 0; depth < MAX_CATEGORY_DEPTH; depth += 1) {
    if (cursor === null) {
      return false;
    }
    if (seen.has(cursor)) {
      return true;
    }
    seen.add(cursor);

    const result: {
      data: { parent_id: string | null } | null;
      error: unknown;
    } = await supabase
      .from('categories')
      .select('parent_id')
      .eq('id', cursor)
      .eq('merchant_id', merchantId)
      .maybeSingle();

    // A failed read cannot prove the absence of a loop. Reporting "no cycle"
    // here would let a transient error write the very edge this guard exists to
    // prevent, so an unreadable chain fails CLOSED.
    if (result.error) {
      return true;
    }

    // A missing row means the chain leaves this merchant — ownership is checked
    // separately, and there is no path back to `categoryId` from here.
    if (!result.data) {
      return false;
    }
    cursor = result.data.parent_id;
  }

  // Depth bound hit: the existing chain is already looping or pathological.
  return true;
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
