import { NextResponse } from 'next/server';
import type {
  CategoryRequestAuth,
  CategoryRouteResolution,
} from './category-route-types';
import { resolveCategoryOwnerAccess } from './resolve-category-owner-access';

/** Resolve a caller-accessible merchant and enforce the owner-only contract. */
export async function resolveCategoryRouteContext(
  auth: CategoryRequestAuth,
  requestedMerchantId?: string
): Promise<CategoryRouteResolution> {
  const { supabase } = auth;
  const access = await resolveCategoryOwnerAccess(
    supabase,
    auth.userId,
    requestedMerchantId
  );
  if (access.kind === 'lookup-failed') {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Could not resolve merchant access' },
        { status: 500 }
      ),
    };
  }
  if (access.kind === 'absent') {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      ),
    };
  }
  if (access.kind === 'staff') {
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
      canonicalMerchantSlug: access.canonicalMerchantSlug,
      merchantId: access.merchantId,
      supabase,
    },
  };
}
