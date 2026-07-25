import { NextResponse } from 'next/server';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { createClient } from '@/lib/supabase/server';

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
  supabase: Awaited<ReturnType<typeof createClient>>;
}

export type CategoryRouteResolution =
  | { ok: true; context: CategoryRouteContext }
  | { ok: false; response: NextResponse };

function isCategoryManager(access: { isOwner?: boolean }): boolean {
  return access.isOwner === true;
}

/**
 * Authenticate, derive the merchant SERVER-SIDE, and reject a mismatched
 * client-supplied merchant id. `requestedMerchantId` is only ever an assertion;
 * it never selects the tenant.
 */
export async function resolveCategoryRouteContext(
  request: Request,
  requestedMerchantId?: string
): Promise<CategoryRouteResolution> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

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

  // Cross-merchant assertion: a staff user belonging to several merchants must
  // never mutate a tenant other than the resolved one. Hard 403, no fallback.
  if (
    requestedMerchantId &&
    requestedMerchantId !== merchantContext.merchantId
  ) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
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

  const identifiers = [merchantContext.merchantSlug].filter(
    (value): value is string => typeof value === 'string' && value.length > 0
  );

  return {
    ok: true,
    context: {
      merchantId: merchantContext.merchantId,
      merchantIdentifiers: identifiers,
      supabase,
    },
  };
}
