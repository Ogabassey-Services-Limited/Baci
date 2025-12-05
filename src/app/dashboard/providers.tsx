'use client';

import AppBody from '@/components/app-body';
import { ProductProvider } from '@/contexts/product-context';
import {
  type MerchantData,
  MerchantProvider,
  type StaffAccess,
  useMerchant,
} from '@/hooks/use-merchant';
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

interface DashboardProvidersProps {
  children: React.ReactNode;
  initialMerchant?: MerchantData | null;
  initialStaffAccess?: StaffAccess;
}

/**
 * Dashboard-specific providers.
 * ProductProvider is scoped to dashboard only (not global) to reduce
 * client-side JavaScript bundle on public pages.
 */
export function DashboardProviders({
  children,
  initialMerchant,
  initialStaffAccess,
}: DashboardProvidersProps) {
  return (
    <MerchantProvider
      initialMerchant={initialMerchant}
      initialStaffAccess={initialStaffAccess}
    >
      <ProductProvider>
        <DashboardClientLayout>
          <ThemedDashboardLayout>{children}</ThemedDashboardLayout>
        </DashboardClientLayout>
      </ProductProvider>
    </MerchantProvider>
  );
}
