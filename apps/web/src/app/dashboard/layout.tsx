import { headers } from 'next/headers';
import { ThemeProvider } from 'next-themes';
import { type ReactNode, Suspense } from 'react';
import '@/app/globals.css';
import { PasskeyEnrollmentPrompt } from '@/components/passkey-enrollment-prompt';
import { DashboardAuthGuard, getTrustedRequestNonce } from './auth-guard';
import DashboardLoading from './loading';

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const nonce = getTrustedRequestNonce(await headers());

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      nonce={nonce}
    >
      <Suspense fallback={<DashboardLoading />}>
        <DashboardAuthGuard>
          <PasskeyEnrollmentPrompt />
          {children}
        </DashboardAuthGuard>
      </Suspense>
    </ThemeProvider>
  );
}
