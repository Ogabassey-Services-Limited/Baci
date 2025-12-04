'use client';

import AppBody from '@/components/app-body';
import { MerchantProvider, useMerchant } from '@/hooks/use-merchant';
import DashboardClientLayout from './client-layout';

// New component to handle fetching merchant and applying theme
function ThemedDashboardLayout({ children }: { children: React.ReactNode }) {
  const { merchant } = useMerchant();
  return (
    <AppBody merchant={merchant} showNewsletterWidget={false}>
      {children}
    </AppBody>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MerchantProvider>
      <DashboardClientLayout>
        <ThemedDashboardLayout>{children}</ThemedDashboardLayout>
      </DashboardClientLayout>
    </MerchantProvider>
  );
}
