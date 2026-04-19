import type { ReactNode } from 'react';
import CustomerAuthLayout from '@/app/(storefront)/[slug]/customer-auth-layout';

export default async function ReceiptsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  return (
    <CustomerAuthLayout params={await params}>{children}</CustomerAuthLayout>
  );
}
