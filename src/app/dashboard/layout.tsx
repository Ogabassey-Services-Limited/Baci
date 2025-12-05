import type { ReactNode } from 'react';
import { getMerchantForUser } from '@/lib/merchant-server';
import { DashboardProviders } from './providers';

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Fetch merchant data server-side
  const { merchant, staffAccess } = await getMerchantForUser();

  return (
    <DashboardProviders
      initialMerchant={merchant}
      initialStaffAccess={staffAccess}
    >
      {children}
    </DashboardProviders>
  );
}
