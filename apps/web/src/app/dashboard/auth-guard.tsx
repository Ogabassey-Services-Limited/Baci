import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getMerchantForUser } from '@/lib/merchant-server';
import { DashboardProviders } from './providers';

export async function DashboardAuthGuard({
  children,
}: {
  children: ReactNode;
}) {
  // Fetch merchant data server-side
  const { merchant, staffAccess, user } = await getMerchantForUser();

  // Server-side auth check - no race conditions!
  if (!user) {
    redirect('/login');
  }

  // Only redirect to onboarding if user is NOT staff and has no merchant
  // Staff members should never see onboarding - they join existing merchants
  if (!merchant && !staffAccess?.isStaff) {
    redirect('/onboarding');
  }

  // Edge case: Staff with no merchant (shouldn't happen, but handle gracefully)
  if (!merchant && staffAccess?.isStaff) {
    console.error('[Dashboard] Staff user has no merchant:', user.id);
    redirect('/error?code=staff_no_merchant');
  }

  return (
    <DashboardProviders
      initialMerchant={merchant}
      initialStaffAccess={staffAccess}
    >
      {children}
    </DashboardProviders>
  );
}
