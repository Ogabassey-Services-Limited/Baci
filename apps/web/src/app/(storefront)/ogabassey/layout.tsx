import type { Metadata } from 'next';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import StorefrontLayout, {
  generateMetadata as generateStorefrontLayoutMetadata,
  generateViewport,
} from '@/app/(storefront)/[slug]/layout';

const OGABASSEY_PARAMS = Promise.resolve({ slug: 'ogabassey' });

export { generateViewport };

export async function generateMetadata(): Promise<Metadata> {
  try {
    return await generateStorefrontLayoutMetadata({
      params: OGABASSEY_PARAMS,
    });
  } catch (error) {
    console.error('Failed to load OgaBassey layout metadata', error);
    return {
      manifest: null,
    };
  }
}

export default async function OgabasseyLayout({
  children,
}: {
  children: ReactNode;
}) {
  await connection();

  return (
    <StorefrontLayout params={OGABASSEY_PARAMS}>{children}</StorefrontLayout>
  );
}
