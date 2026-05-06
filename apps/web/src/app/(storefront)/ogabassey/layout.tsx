import { connection } from 'next/server';
import type { ReactNode } from 'react';
import StorefrontLayout, { generateViewport } from '../[slug]/layout';

const OGABASSEY_PARAMS = Promise.resolve({ slug: 'ogabassey' });

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
