import { connection } from 'next/server';
import { Suspense } from 'react';

function createStorefrontDynamicMetadataHost() {
  return (
    <div aria-hidden="true" data-storefront-dynamic-metadata-marker="" hidden />
  );
}

async function StorefrontDynamicMetadataConnection() {
  await connection();
  return createStorefrontDynamicMetadataHost();
}

/**
 * Next 16 PPR marker for routes whose `generateMetadata()` is request-time.
 * Keep this as an early route-shell sibling instead of awaiting `connection()`
 * at the page boundary; page-level `connection()` blocks prerendered shells,
 * and placing the marker after route-level Suspense wrappers has produced
 * metadata-boundary resume mismatches on Vercel.
 *
 * The fallback must be a stable host node. A null fallback leaves no prerendered
 * DOM slot, then the request-time metadata boundary can resume where React
 * expects the next storefront <div>.
 */
export function StorefrontDynamicMetadataMarker() {
  return (
    <Suspense fallback={createStorefrontDynamicMetadataHost()}>
      <StorefrontDynamicMetadataConnection />
    </Suspense>
  );
}
