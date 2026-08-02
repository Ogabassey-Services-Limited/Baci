'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import {
  ensurePermission,
  isMerchantPermissionRedirectError,
  MerchantAuthenticationRequiredError,
} from '@/lib/merchant-server';
import { createClient } from '@/lib/supabase/server';
import {
  generateSEOSuggestionsInputSchema,
  saveSEOSettingsInputSchema,
  seoMerchantIdSchema,
} from '@/schemas/dashboard-seo-actions';
import { generateSEOSuggestionsForMerchant } from './generate-seo-suggestions';
import { getSEOStatusForMerchant } from './get-seo-status';
import { revalidateSeoProductCaches } from './revalidate-seo-product-caches';

export type {
  ProductSEO,
  SEOOptimization,
  SEOSummary,
} from './seo-analysis';

async function getAuthenticatedSEOClient() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new MerchantAuthenticationRequiredError();
  }
  return supabase;
}

export async function getSEOStatus(merchantId: string) {
  const supabase = await getAuthenticatedSEOClient();
  const parsedMerchantId = seoMerchantIdSchema.safeParse(merchantId);
  if (!parsedMerchantId.success) {
    throw new Error('Invalid merchant id');
  }

  // Authorize via the session merchant — never trust the caller-supplied id.
  const { merchant } = await ensurePermission('products', 'view');
  if (parsedMerchantId.data !== merchant.id) {
    throw new Error('Merchant mismatch');
  }
  return getSEOStatusForMerchant(supabase, merchant.id);
}

export async function generateSEOSuggestions(
  merchantId: string,
  productIds: string[]
) {
  const supabase = await getAuthenticatedSEOClient();
  const parsed = generateSEOSuggestionsInputSchema.safeParse({
    merchantId,
    productIds,
  });
  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message ?? 'Invalid SEO suggestion request'
    );
  }

  // Authorize via the session merchant — never trust the caller-supplied id.
  const { merchant } = await ensurePermission('products', 'view');
  if (parsed.data.merchantId !== merchant.id) {
    throw new Error('Merchant mismatch');
  }
  return generateSEOSuggestionsForMerchant(
    supabase,
    merchant.id,
    parsed.data.productIds
  );
}

/**
 * Resolve the session merchant with `products.edit` access. Returns null for
 * expected permission failures and rethrows unexpected errors so incidents
 * (DB outages, bugs) are never masked as permission denials.
 */
async function getSEOEditMerchant(): Promise<{ id: string } | null> {
  try {
    const { merchant } = await ensurePermission('products', 'edit');
    return merchant;
  } catch (error) {
    if (isMerchantPermissionRedirectError(error)) {
      return null;
    }
    throw error;
  }
}

export async function saveSEOSettings(
  merchantId: string,
  optimizations: {
    productId: string;
    meta_title: string;
    meta_description: string;
    keywords: string[];
  }[]
) {
  let supabase: Awaited<ReturnType<typeof getAuthenticatedSEOClient>>;
  try {
    supabase = await getAuthenticatedSEOClient();
  } catch (error) {
    if (!(error instanceof MerchantAuthenticationRequiredError)) {
      throw error;
    }
    return {
      success: false,
      updated: 0,
      failed: optimizations?.length ?? 0,
      message: 'Authentication required',
    };
  }

  const parsed = saveSEOSettingsInputSchema.safeParse({
    merchantId,
    optimizations,
  });
  if (!parsed.success) {
    return {
      success: false,
      updated: 0,
      failed: optimizations?.length ?? 0,
      message: 'Invalid SEO settings payload',
    };
  }

  // Authorize via the session merchant — never trust the caller-supplied id.
  const merchant = await getSEOEditMerchant();
  if (!merchant) {
    return {
      success: false,
      updated: 0,
      failed: parsed.data.optimizations.length,
      message: 'Permission denied',
    };
  }
  if (parsed.data.merchantId !== merchant.id) {
    return {
      success: false,
      updated: 0,
      failed: parsed.data.optimizations.length,
      message: 'Merchant mismatch',
    };
  }

  const results = await Promise.allSettled(
    parsed.data.optimizations.map((optimization) =>
      supabase
        .from('products')
        .update({
          meta_title: optimization.meta_title,
          meta_description: optimization.meta_description,
          keywords: optimization.keywords,
        })
        .eq('id', optimization.productId)
        .eq('merchant_id', merchant.id)
    )
  );
  const errors = results.filter(
    (result) =>
      result.status === 'rejected' ||
      (result.status === 'fulfilled' && result.value.error)
  );
  const fulfilledProductIds = results.flatMap((result, index) => {
    const optimization = parsed.data.optimizations[index];
    if (result.status === 'fulfilled' && !result.value.error && optimization) {
      return [optimization.productId];
    }
    return [];
  });
  await revalidateSeoProductCaches(supabase, merchant.id, fulfilledProductIds);

  if (errors.length > 0) {
    console.error('Failed to update some products:', errors);
    return {
      success: errors.length < results.length,
      updated: results.length - errors.length,
      failed: errors.length,
      message: `Updated ${results.length - errors.length} products, ${errors.length} failed`,
    };
  }

  revalidatePath('/dashboard/seo');
  return { success: true, updated: results.length, failed: 0 };
}
