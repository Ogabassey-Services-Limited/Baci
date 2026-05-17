import { type NextRequest, NextResponse } from 'next/server';
import { generateFacebookCatalogFeedForIdentifier } from '@/app/api/feed/facebook/feed-service';
import { getRootDomain } from '@/env';
import { CACHE_HEADERS } from '@/lib/cache-headers';
import { logger } from '@/lib/logger';
import { resolveStorefrontMerchantFromRequest } from '@/lib/storefront-merchant';
import { escapeXml } from '@/lib/xml-utils';

const ROOT_DOMAIN = (getRootDomain() || 'usebaci.com').toLowerCase();

function buildXmlErrorResponse(error: string, status: number): NextResponse {
  return new NextResponse(
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<error>',
      `  <message>${escapeXml(error)}</message>`,
      '</error>',
    ].join('\n'),
    {
      status,
      headers: { 'Content-Type': 'application/xml; charset=utf-8' },
    }
  );
}

export async function GET(request: NextRequest) {
  const resolution = await resolveStorefrontMerchantFromRequest({
    request,
    rootDomain: ROOT_DOMAIN,
    notFoundError:
      'Facebook catalog feed is only available on storefront hosts',
    lookupError: 'Failed to resolve storefront for Facebook catalog feed',
  });

  if (!resolution.success) {
    if (resolution.status === 500) {
      logger.error({
        message: 'FACEBOOK_CATALOG_PUBLIC_FEED_ERROR',
        error: resolution.cause,
      });
    }

    return buildXmlErrorResponse(resolution.error, resolution.status);
  }

  const result = await generateFacebookCatalogFeedForIdentifier({
    identifier: resolution.merchant.slug,
    isBySlug: true,
  });

  if (!result.success) {
    return buildXmlErrorResponse(result.error, result.status);
  }

  return new NextResponse(result.xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      ...CACHE_HEADERS.LONG,
    },
  });
}
