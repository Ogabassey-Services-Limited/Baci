import { connection } from 'next/server';
import { Suspense } from 'react';

async function StorefrontDynamicMetadataConnection() {
  await connection();
  return null;
}

export function StorefrontDynamicMetadataMarker() {
  return (
    <div aria-hidden="true" data-storefront-dynamic-metadata-marker="" hidden>
      {/* Keep a stable host slot so streamed metadata cannot displace sibling Suspense fallbacks. */}
      <Suspense fallback={null}>
        <StorefrontDynamicMetadataConnection />
      </Suspense>
    </div>
  );
}
