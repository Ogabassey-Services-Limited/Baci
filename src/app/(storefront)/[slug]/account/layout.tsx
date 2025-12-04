import { notFound } from 'next/navigation';
import { CustomerAuthProvider } from '@/contexts/customer-auth-context';
import { MerchantProvider } from '@/hooks/use-merchant';
import { getCachedMerchant } from '@/lib/cached-data';

export default async function AccountLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const merchant = await getCachedMerchant(slug);

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
