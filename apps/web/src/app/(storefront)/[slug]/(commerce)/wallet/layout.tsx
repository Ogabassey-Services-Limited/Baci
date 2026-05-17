import type { ReactNode } from 'react';
import CustomerAuthLayout from '@/app/(storefront)/[slug]/customer-auth-layout';

export default async function WalletLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = await params;

  return (
    <CustomerAuthLayout params={{ slug: resolvedParams.slug.toLowerCase() }}>
      {children}
    </CustomerAuthLayout>
  );
}
