import { type NextRequest, NextResponse } from 'next/server';
import { getStorefrontPublicationCacheIdentity } from '@/lib/get-storefront-publication-cache-identity';
import { loadStoreLaunchReadiness } from '@/lib/store-readiness/load-store-launch-readiness';
import { getStorePublicationMissingItems } from '@/lib/store-readiness/store-publication-missing-items';
import { evictStorefrontPublicationCaches } from '@/lib/storefront-publication-cache-eviction';
import { resolvePublishMerchantAccess } from './resolve-publish-merchant-access';

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
    const merchantAccess = await resolvePublishMerchantAccess(request);
    if (!merchantAccess.ok) return merchantAccess.response;

    const { merchantId, supabase } = merchantAccess;
    const launchReadiness = await loadStoreLaunchReadiness({
      supabase,
      merchantId,
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
        merchantId,
        launchReadiness.slug
      );

    // All checks passed, publish the store
    const { error: updateError } = await supabase
      .from('merchants')
      .update({
        is_published: true,
        published_at: new Date().toISOString(),
      })
      .eq('id', merchantId);

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
    const merchantAccess = await resolvePublishMerchantAccess(request);
    if (!merchantAccess.ok) return merchantAccess.response;

    // The resolver returns the auth-scoped client, so mobile Bearer-token
    // requests satisfy RLS. See POST handler for the matching publish flow.
    const { merchantId, supabase } = merchantAccess;

    // Get merchant
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id, slug')
      .eq('id', merchantId)
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
        merchantId,
        merchant.slug
      );

    // Unpublish the store
    const { error: updateError } = await supabase
      .from('merchants')
      .update({
        is_published: false,
      })
      .eq('id', merchantId);

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
