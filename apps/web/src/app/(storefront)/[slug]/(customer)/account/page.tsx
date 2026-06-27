import type { Metadata } from 'next';
import { getStorefrontAccountInitialCustomer } from '@/lib/storefront-account-initial-session';
import { AccountPageClient } from './account-client';

export const metadata: Metadata = {
  title: 'Your Account',
  description: 'Manage your account, orders, and preferences.',
  robots: { index: false },
};

export default async function AccountPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const initialCustomer = await getStorefrontAccountInitialCustomer(slug);

  return (
    <>
      <h1 className="sr-only">Your Account</h1>
      <AccountPageClient initialCustomer={initialCustomer} />
    </>
  );
}
