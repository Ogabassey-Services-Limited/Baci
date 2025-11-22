
'use client';

import { MerchantProvider, useMerchant } from '@/hooks/use-merchant';
import DashboardClientLayout from './client-layout';
import AppBody from '@/components/app-body';

// New component to handle fetching merchant and applying theme
function ThemedDashboardLayout({ children }: { children: React.ReactNode }) {
  const { merchant } = useMerchant();
  return <AppBody merchant={merchant}>{children}</AppBody>;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MerchantProvider>
      <ThemedDashboardLayout>
        <DashboardClientLayout>{children}</DashboardClientLayout>
      </ThemedDashboardLayout>
    </MerchantProvider>
  );
}
