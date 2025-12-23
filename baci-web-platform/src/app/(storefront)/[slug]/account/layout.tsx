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

  let merchant;
  if (slug.includes('.')) {
    merchant = await getCachedMerchantByDomain(slug);
  } else {
    merchant = await getCachedMerchant(slug);
  }

  if (!merchant) {
    notFound();
  }

  return (
    <MerchantProvider slug={slug}>
      <CustomerAuthProvider merchantSlug={slug}>
        {children}
      </CustomerAuthProvider>
    </MerchantProvider>
  );
}
