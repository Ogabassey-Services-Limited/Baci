import { connection } from 'next/server';

export async function StorefrontDynamicMetadataMarker() {
  await connection();
  return null;
}
