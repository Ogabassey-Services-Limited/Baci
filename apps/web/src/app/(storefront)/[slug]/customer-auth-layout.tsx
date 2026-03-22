import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { CustomerAuthProvider } from '@/contexts/customer-auth-context';
import {
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';
import { isDomainIdentifier } from '@/lib/validation';

export default async function CustomerAuthLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { slug: string };
}) {
  const { slug } = params;

  const merchant = isDomainIdentifier(slug)
    ? await getCachedMerchantByDomain(slug)
    : await getCachedMerchant(slug);

  if (!merchant) {
    notFound();
  }

  return (
    <CustomerAuthProvider merchantSlug={merchant.slug}>
      {children}
    </CustomerAuthProvider>
  );
}
