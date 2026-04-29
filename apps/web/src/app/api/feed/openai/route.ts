import { gzipSync } from 'node:zlib';
import { type NextRequest, NextResponse } from 'next/server';
import { getRootDomain } from '@/env';
import { CACHE_HEADERS } from '@/lib/cache-headers';
import { getMerchantByIdentifier } from '@/lib/cached-data';
import {
  MerchantNotFoundError,
  resolveFeedMerchant,
} from '@/lib/feed-identifier';
import { buildStoreUrl } from '@/lib/store-url';
import {
  buildRequestBaseUrl,
  resolveStorefrontRouteIdentifiers,
} from '@/lib/storefront-host';
import { openAIFeedQuerySchema } from '@/schemas/openai-feed-query';
import { RouteIdentifierSchema } from '@/schemas/route-identifier';
import { generateCurrentOpenAIProductFeed } from './current-feed-generator';
import { getCachedOpenAIFeedData } from './feed-data';
import type { Merchant } from './feed-types';
import { generateOpenAIFeed } from './legacy-feed-generator';

const ROOT_DOMAIN = (getRootDomain() || 'usebaci.com').toLowerCase();

type VerifiedFeedBaseUrlResult =
  | { success: true; baseUrl: string; isStorefrontScoped: boolean }
  | { success: false; response: NextResponse };

async function resolveVerifiedFeedBaseUrl(
  merchant: Merchant,
  request: Request
): Promise<VerifiedFeedBaseUrlResult> {
  const routeIdentifiers = resolveStorefrontRouteIdentifiers({
    request,
    rootDomain: ROOT_DOMAIN,
  });

  if (routeIdentifiers.length === 0) {
    return {
      success: true,
      baseUrl: buildStoreUrl(merchant),
      isStorefrontScoped: false,
    };
  }

  const parsedRouteIdentifiers: string[] = [];

  // Identifier candidates are derived from the same host; reject malformed
  // hosts instead of falling through to a lower-priority fallback.
  for (const routeIdentifier of routeIdentifiers) {
    const parsedRouteIdentifier =
      RouteIdentifierSchema.safeParse(routeIdentifier);

    if (!parsedRouteIdentifier.success) {
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Invalid storefront host' },
          { status: 400 }
        ),
      };
    }

    parsedRouteIdentifiers.push(parsedRouteIdentifier.data);
  }

  // Candidates are ordered by storefront-host priority. Non-www custom domains
  // intentionally win before the exact www fallback to match proxy behavior.
  // The candidate set is bounded to one or two identifiers, so sequential
  // lookup keeps the priority contract explicit without adding a bulk API.
  for (const routeIdentifier of parsedRouteIdentifiers) {
    const storefrontMerchant = await getMerchantByIdentifier(routeIdentifier);

    if (!storefrontMerchant) {
      continue;
    }

    if (storefrontMerchant.id !== merchant.id) {
      // A higher-priority identifier resolving to a different merchant is a
      // genuine host mismatch, not a fallback case.
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Merchant slug does not match storefront host' },
          { status: 400 }
        ),
      };
    }

    return {
      success: true,
      baseUrl: buildRequestBaseUrl(request),
      isStorefrontScoped: true,
    };
  }

  return {
    success: false,
    response: NextResponse.json(
      { error: 'No storefront found for the given host' },
      { status: 400 }
    ),
  };
}

/**
 * OpenAI Product Feed API
 *
 * Generates a JSONL feed compatible with OpenAI's Product Feed Spec
 * @see https://developers.openai.com/commerce/specs/feed
 *
 * Usage: /api/feed/openai?merchant_id=xxx
 * or: /api/feed/openai?merchant_slug=xxx
 * or: /api/feed/openai?merchant_slug=xxx&format=jsonl (gzipped)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rawParams = {
    merchant_id: searchParams.get('merchant_id') || undefined,
    merchant_slug: searchParams.get('merchant_slug') || undefined,
    format: searchParams.get('format') || undefined,
  };

  const parsed = openAIFeedQuerySchema.safeParse(rawParams);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message || 'Invalid query parameters',
      },
      { status: 400 }
    );
  }

  const {
    merchant_id: merchantIdParam,
    merchant_slug: merchantSlug,
    format,
  } = parsed.data;

  try {
    // Resolve merchant outside cache so tags use canonical UUID
    const identifier = merchantIdParam || merchantSlug || '';
    const isBySlug = !merchantIdParam && !!merchantSlug;
    const merchant = await resolveFeedMerchant(identifier, isBySlug);

    const baseUrlResult = await resolveVerifiedFeedBaseUrl(merchant, request);

    if (!baseUrlResult.success) {
      return baseUrlResult.response;
    }

    const { products } = await getCachedOpenAIFeedData(merchant.id);
    const cacheHeaders = baseUrlResult.isStorefrontScoped
      ? CACHE_HEADERS.SHORT
      : CACHE_HEADERS.LONG;

    // Generate JSONL feed
    const feedLines =
      format === 'current'
        ? generateCurrentOpenAIProductFeed(
            products,
            merchant,
            baseUrlResult.baseUrl
          )
        : generateOpenAIFeed(products, merchant, baseUrlResult.baseUrl);
    const feedContent = feedLines.join('\n');

    // Return gzipped if format=jsonl requested
    if (format === 'jsonl') {
      const gzipped = gzipSync(Buffer.from(feedContent, 'utf-8'));
      return new NextResponse(gzipped, {
        status: 200,
        headers: {
          'Content-Type': 'application/gzip',
          'Content-Disposition': `attachment; filename="${merchant.slug}-openai-feed.jsonl.gz"`,
          'Content-Encoding': 'gzip',
          ...cacheHeaders,
        },
      });
    }

    // Default: return plain JSONL for debugging/preview
    return new NextResponse(feedContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        ...cacheHeaders,
      },
    });
  } catch (error) {
    console.error('OPENAI_FEED_GENERATION_ERROR:', error);
    if (error instanceof MerchantNotFoundError) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to generate feed' },
      { status: 500 }
    );
  }
}
