import { NextResponse } from 'next/server';
import {
  getStorefrontCacheActuatorSecret,
  getStorefrontCacheCanaryMerchantId,
  verifyStorefrontCacheActuatorRequest,
} from '@/lib/events/storefront-cache-actuator-auth';
import { runStorefrontCategoryCacheBarrier } from '@/lib/storefront-category-cache-barrier';
import {
  storefrontCacheActuatorReceiptSchema,
  storefrontCacheActuatorSchema,
} from '@/schemas/storefront-cache-actuator';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' } as const;

/**
 * The delivery worker's only cache authority. It deliberately owns neither a
 * database client nor provider credentials: it authenticates one fixed body,
 * then delegates to the bounded server-only category cache barrier.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const rawBody = await request.text();
  const authentication = verifyStorefrontCacheActuatorRequest({
    rawBody,
    secret: getStorefrontCacheActuatorSecret(),
    signatureHeader: request.headers.get('x-baci-storefront-cache-signature'),
    timestampHeader: request.headers.get('x-baci-storefront-cache-timestamp'),
  });
  if (!authentication.ok) {
    return NextResponse.json(
      { error: 'Unauthorized', ok: false },
      { headers: NO_STORE_HEADERS, status: 401 }
    );
  }

  let untrustedBody: unknown;
  try {
    untrustedBody = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: 'Invalid cache transition request', ok: false },
      { headers: NO_STORE_HEADERS, status: 400 }
    );
  }
  const parsedBody = storefrontCacheActuatorSchema.safeParse(untrustedBody);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: 'Invalid cache transition request', ok: false },
      { headers: NO_STORE_HEADERS, status: 400 }
    );
  }

  const body = parsedBody.data;
  let barrier: Awaited<ReturnType<typeof runStorefrontCategoryCacheBarrier>>;
  try {
    barrier = await runStorefrontCategoryCacheBarrier({
      canaryMerchantId: getStorefrontCacheCanaryMerchantId(),
      merchantId: body.merchantId,
      nextSlug: body.nextSlug,
      previousSlug: body.previousSlug,
      relatedSlugs: body.relatedSlugs,
    });
  } catch {
    return NextResponse.json(
      { error: 'Storefront cache barrier unavailable', ok: false },
      { headers: NO_STORE_HEADERS, status: 503 }
    );
  }
  if (!barrier.ok) {
    return NextResponse.json(
      { error: 'Storefront cache barrier unavailable', ok: false },
      { headers: NO_STORE_HEADERS, status: 503 }
    );
  }

  const receipt = storefrontCacheActuatorReceiptSchema.parse({
    completedAt: new Date().toISOString(),
    generation: body.generation,
    obligationId: body.obligationId,
    requestBodySha256: authentication.requestBodySha256,
    schemaVersion: 1,
  });
  return NextResponse.json(
    { ok: true, receipt },
    { headers: NO_STORE_HEADERS, status: 200 }
  );
}
