import { type NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
} from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { getStorefrontPublicationCacheIdentity } from '@/lib/get-storefront-publication-cache-identity';
import { loadStoreLaunchReadiness } from '@/lib/store-readiness/load-store-launch-readiness';
import { getStorePublicationMissingItems } from '@/lib/store-readiness/store-publication-missing-items';
import { evictStorefrontPublicationCaches } from '@/lib/storefront-publication-cache-eviction';

function storefrontCacheEvictionFailureResponse(): NextResponse {
  return NextResponse.json(
    {
      error:
        'Store state changed, but storefront cache eviction could not be confirmed',
      code: 'STOREFRONT_CACHE_EVICTION_FAILED',
      retryable: true,
    },
    { status: 503 }
  );
}

/**
 * Store Publish API
 *
 * POST - Publish the merchant's store (make it publicly accessible)
 * DELETE - Unpublish the store (take it offline)
 */

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(request);
    if (!csrfValid) {
      return (
        csrfResponse ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const access = await getUserAccess(auth.supabase);
    if (!access) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    if (!hasPermission(access, 'settings', 'edit')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const supabase = auth.supabase;
    const launchReadiness = await loadStoreLaunchReadiness({
      supabase,
      merchantId: access.merchantId,
    });

    if (!launchReadiness.isReady) {
      return NextResponse.json(
        {
          error: 'Cannot publish store',
          message: 'Please complete the following required items:',
          missingItems: getStorePublicationMissingItems(launchReadiness),
        },
        { status: 400 }
      );
    }

    // Resolve every public alias before the state mutation. A lookup failure
    // must not be mistaken for an empty identity set and leave cached HTML live.
    const publicationCacheIdentity =
      await getStorefrontPublicationCacheIdentity(
        supabase,
        launchReadiness.merchantId,
        launchReadiness.slug
      );

    // All checks passed, publish the store
    const { error: updateError } = await supabase
      .from('merchants')
      .update({
        is_published: true,
        published_at: new Date().toISOString(),
      })
      .eq('id', launchReadiness.merchantId);

    if (updateError) {
      console.error('Error publishing store:', updateError);
      return NextResponse.json(
        { error: 'Failed to publish store' },
        { status: 500 }
      );
    }

    // Publication transitions must never use stale-while-revalidate: hard-
    // expire the merchant and features snapshots, then evict cached public
    // documents through the same confirmed barrier.
    const cacheEvictionResult = await evictStorefrontPublicationCaches(
      publicationCacheIdentity
    );
    if (!cacheEvictionResult.ok) {
      return storefrontCacheEvictionFailureResponse();
    }

    return NextResponse.json({
      success: true,
      message: 'Store published successfully',
    });
  } catch (error) {
    console.error('Store publish error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(request);
    if (!csrfValid) {
      return (
        csrfResponse ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const access = await getUserAccess(auth.supabase);
    if (!access) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    if (!hasPermission(access, 'settings', 'edit')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Use the auth-scoped client from authenticateApiRequest so mobile
    // (Bearer token) requests satisfy RLS. See POST handler for context.
    const supabase = auth.supabase;

    // Get merchant
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id, slug')
      .eq('id', access.merchantId)
      .maybeSingle();

    if (merchantError) {
      console.error('[Unpublish API] merchant read failed:', merchantError);
      return NextResponse.json(
        { error: 'Failed to load merchant' },
        { status: 500 }
      );
    }

    if (!merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Capture every current public identity before mutating publication state.
    const publicationCacheIdentity =
      await getStorefrontPublicationCacheIdentity(
        supabase,
        merchant.id,
        merchant.slug
      );

    // Unpublish the store
    const { error: updateError } = await supabase
      .from('merchants')
      .update({
        is_published: false,
      })
      .eq('id', merchant.id);

    if (updateError) {
      console.error('Error unpublishing store:', updateError);
      return NextResponse.json(
        { error: 'Failed to unpublish store' },
        { status: 500 }
      );
    }

    // Publication transitions must never use stale-while-revalidate: hard-
    // expire the merchant and features snapshots, then evict cached public
    // documents through the same confirmed barrier.
    const cacheEvictionResult = await evictStorefrontPublicationCaches(
      publicationCacheIdentity
    );
    if (!cacheEvictionResult.ok) {
      return storefrontCacheEvictionFailureResponse();
    }

    return NextResponse.json({
      success: true,
      message: 'Store unpublished successfully',
    });
  } catch (error) {
    console.error('Store unpublish error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
