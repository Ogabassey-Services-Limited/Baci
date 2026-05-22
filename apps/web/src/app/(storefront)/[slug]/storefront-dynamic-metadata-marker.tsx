import { connection } from 'next/server';
import { Suspense } from 'react';

async function StorefrontDynamicMetadataConnection() {
  await connection();
  return null;
}

export function StorefrontDynamicMetadataMarker() {
  return (
    <Suspense fallback={null}>
      <StorefrontDynamicMetadataConnection />
    </Suspense>
  );
}
