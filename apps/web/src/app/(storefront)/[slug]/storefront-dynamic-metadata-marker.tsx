import { connection } from 'next/server';
import { Suspense } from 'react';

async function StorefrontDynamicMetadataConnection() {
  await connection();
  return null;
}

/**
 * Next 16 PPR marker for routes whose `generateMetadata()` is request-time.
 * Keep this after the route shell instead of awaiting `connection()` at the
 * page boundary; page-level `connection()` blocks prerendered shells and has
 * produced metadata-boundary resume mismatches on Vercel.
 */
export function StorefrontDynamicMetadataMarker() {
  return (
    <Suspense fallback={null}>
      <StorefrontDynamicMetadataConnection />
    </Suspense>
  );
}
