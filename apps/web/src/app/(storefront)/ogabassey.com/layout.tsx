import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import StorefrontLayout, {
  generateMetadata as generateStorefrontLayoutMetadata,
  generateViewport,
} from '@/app/(storefront)/[slug]/layout';
import { OGABASSEY_URL } from '@/config/ogabassey';

const OGABASSEY_DOMAIN_PARAMS = Promise.resolve({
  slug: new URL(OGABASSEY_URL).hostname,
});

export { generateViewport };

export async function generateMetadata(): Promise<Metadata> {
  try {
    return await generateStorefrontLayoutMetadata({
      params: OGABASSEY_DOMAIN_PARAMS,
    });
  } catch (error) {
    console.error('Failed to load OgaBassey domain layout metadata', error);
    return {
      manifest: null,
    };
  }
}

export default function OgabasseyDomainLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <StorefrontLayout params={OGABASSEY_DOMAIN_PARAMS}>
      {children}
    </StorefrontLayout>
  );
}
