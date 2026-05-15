'use client';

import type { User } from '@supabase/supabase-js';
import { ThemeProvider } from 'next-themes';
import AppBody from '@/components/app-body';
import { CsrfInitializer } from '@/components/csrf-initializer';
import { AuthProvider } from '@/contexts/auth-context';
import { MotionNonceProvider } from '@/contexts/MotionNonceProvider';
import { NonceProvider, useNonce } from '@/contexts/NonceProvider';
import { ProductProvider } from '@/contexts/product-context';
import type { MerchantData, StaffAccess } from '@/hooks/use-merchant';
import { MerchantProvider, useMerchant } from '@/hooks/use-merchant-client';
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
  initialUser?: User | null;
  initialMerchant?: MerchantData | null;
  initialStaffAccess?: StaffAccess;
  nonce?: string;
}

type DashboardProvidersContentProps = Omit<DashboardProvidersProps, 'nonce'>;

export function DashboardProviders({
  children,
  initialUser,
  initialMerchant,
  initialStaffAccess,
  nonce,
}: DashboardProvidersProps) {
  return (
    <NonceProvider nonce={nonce}>
      <DashboardProvidersContent
        initialUser={initialUser}
        initialMerchant={initialMerchant}
        initialStaffAccess={initialStaffAccess}
      >
        {children}
      </DashboardProvidersContent>
    </NonceProvider>
  );
}

function DashboardProvidersContent({
  children,
  initialUser,
  initialMerchant,
  initialStaffAccess,
}: DashboardProvidersContentProps) {
  const { nonce } = useNonce();

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      nonce={nonce}
    >
      <MotionNonceProvider>
        <AuthProvider initialUser={initialUser}>
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
      </MotionNonceProvider>
    </ThemeProvider>
  );
}
