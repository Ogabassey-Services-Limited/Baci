import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import StorefrontLayout, {
  generateMetadata as generateStorefrontLayoutMetadata,
  generateViewport,
} from '@/app/(storefront)/[slug]/layout';
import { OGABASSEY_TEMPLATE_ID } from '@/config/templates';
import { resolveMerchantContextIdentifier } from '@/lib/storefront-route-identifier';

async function resolveOgabasseyLayoutParams() {
  const headersList = await headers();
  return {
    slug:
      resolveMerchantContextIdentifier(headersList) || OGABASSEY_TEMPLATE_ID,
  };
}

export { generateViewport };

export async function generateMetadata(): Promise<Metadata> {
  try {
    return await generateStorefrontLayoutMetadata({
      params: resolveOgabasseyLayoutParams(),
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
    <StorefrontLayout params={resolveOgabasseyLayoutParams()}>
      {children}
    </StorefrontLayout>
  );
}
