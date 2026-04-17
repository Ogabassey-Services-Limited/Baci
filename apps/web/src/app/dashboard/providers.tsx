'use client';

import AppBody from '@/components/app-body';
import { CsrfInitializer } from '@/components/csrf-initializer';
import { AuthProvider } from '@/contexts/auth-context';
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
    <AppBody
      merchant={merchant}
      showCookieConsent={false}
      showNewsletterWidget={false}
      applyMerchantCoreThemeVariables={false}
    >
      {children}
    </AppBody>
  );
}

interface DashboardProvidersProps {
  children: React.ReactNode;
  initialMerchant?: MerchantData | null;
  initialStaffAccess?: StaffAccess;
}

export function DashboardProviders({
  children,
  initialMerchant,
  initialStaffAccess,
}: DashboardProvidersProps) {
  return (
    <AuthProvider>
      <CsrfInitializer />
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
    </AuthProvider>
  );
}
