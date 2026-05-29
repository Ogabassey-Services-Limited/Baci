import { connection } from 'next/server';
import { Suspense } from 'react';

async function StorefrontDynamicMetadataConnection() {
  await connection();
  return null;
}

/**
 * @deprecated Do not render this from storefront page bodies. Page modules
 * should call `await connection()` directly before returning their shell; this
 * Suspense marker can put Next metadata boundaries into body resume slots.
 */
export function StorefrontDynamicMetadataMarker() {
  return (
    <Suspense fallback={null}>
      <StorefrontDynamicMetadataConnection />
    </Suspense>
  );
}
