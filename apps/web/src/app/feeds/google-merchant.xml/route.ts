import { NextRequest, NextResponse } from 'next/server';
import { GET as getGoogleMerchantFeed } from '@/app/api/feed/google-merchant/route';
import { getRootDomain } from '@/env';
import { resolveStorefrontMerchantFromRequest } from '@/lib/storefront-merchant';

const ROOT_DOMAIN = (getRootDomain() || 'usebaci.com').toLowerCase();

function escapeXmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildXmlErrorResponse(error: string, status: number): NextResponse {
  return new NextResponse(
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<error>',
      `  <message>${escapeXmlText(error)}</message>`,
      '</error>',
    ].join('\n'),
    {
      status,
      headers: { 'Content-Type': 'application/xml; charset=utf-8' },
    }
  );
}

function getDelegatedErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const error = 'error' in payload ? payload.error : null;
  if (typeof error === 'string') {
    return error;
  }

  const message = 'message' in payload ? payload.message : null;
  return typeof message === 'string' ? message : null;
}

async function toXmlErrorResponse(response: Response): Promise<Response> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/xml')) {
    return response;
  }

  let error = response.statusText || 'Failed to generate feed';
  try {
    if (contentType.includes('application/json')) {
      error = getDelegatedErrorMessage(await response.clone().json()) || error;
    } else {
      error = (await response.clone().text()).trim() || error;
    }
  } catch {
    // Fall back to the HTTP status text when the delegated body is unreadable.
  }

  return buildXmlErrorResponse(error, response.status);
}

export async function GET(request: NextRequest) {
  const resolution = await resolveStorefrontMerchantFromRequest({
    request,
    rootDomain: ROOT_DOMAIN,
    notFoundError: 'Google Merchant feed is only available on storefront hosts',
    lookupError: 'Failed to resolve storefront for Google Merchant feed',
  });

  if (!resolution.success) {
    if (resolution.status === 500) {
      console.error('GOOGLE_MERCHANT_PUBLIC_FEED_ERROR:', resolution.cause);
    }

    return buildXmlErrorResponse(resolution.error, resolution.status);
  }

  const feedUrl = new URL('/api/feed/google-merchant', request.url);
  feedUrl.searchParams.set('merchant_slug', resolution.merchant.slug);

  const response = await getGoogleMerchantFeed(
    new NextRequest(feedUrl, {
      headers: request.headers,
    })
  );

  if (response.ok) {
    return response;
  }

  return toXmlErrorResponse(response);
}
