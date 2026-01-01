import { notFound } from 'next/navigation';
import { CustomerAuthProvider } from '@/contexts/customer-auth-context';
import { MerchantProvider } from '@/hooks/use-merchant';
import {
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';
import { isDomainIdentifier } from '@/lib/validation';

export default async function AccountLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const merchant = isDomainIdentifier(slug)
    ? await getCachedMerchantByDomain(slug)
    : await getCachedMerchant(slug);

  if (!merchant) {
    notFound();
  }

  // Use merchant.slug (not the URL slug param) to ensure consistency
  // This is important for custom domain access where slug param is the domain
  return (
    <MerchantProvider slug={slug}>
      <CustomerAuthProvider merchantSlug={merchant.slug}>
        {children}
      </CustomerAuthProvider>
    </MerchantProvider>
  );
}
