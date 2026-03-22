import type { Metadata } from 'next';
import { AccountPageClient } from './account-client';

export const metadata: Metadata = {
  title: 'Your Account',
  description: 'Manage your account, orders, and preferences.',
  robots: { index: false },
};

export default function AccountPage() {
  return (
    <>
      <h1 className="sr-only">Your Account</h1>
      <AccountPageClient />
    </>
  );
}
