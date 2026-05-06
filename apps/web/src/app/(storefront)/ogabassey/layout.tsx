import type { Metadata } from 'next';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import StorefrontLayout, {
  generateViewport,
} from '@/app/(storefront)/[slug]/layout';

const OGABASSEY_PARAMS = Promise.resolve({ slug: 'ogabassey' });

export const metadata: Metadata = {
  manifest: null,
};

export { generateViewport };

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
