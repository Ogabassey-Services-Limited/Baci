import { connection } from 'next/server';
import { Suspense } from 'react';

async function StorefrontDynamicMetadataConnection() {
  await connection();
  return null;
}

export function StorefrontDynamicMetadataMarker() {
  return (
    <div aria-hidden="true" data-storefront-dynamic-metadata-marker="" hidden>
      <Suspense fallback={null}>
        <StorefrontDynamicMetadataConnection />
      </Suspense>
    </div>
  );
}
