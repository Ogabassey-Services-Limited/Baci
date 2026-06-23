import { type ReactNode, Suspense } from 'react';
import '@/app/globals.css';
import { PasskeyEnrollmentPrompt } from '@/components/passkey-enrollment-prompt';
import { DashboardAuthGuard } from './auth-guard';
import DashboardLoading from './loading';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardAuthGuard>
        <PasskeyEnrollmentPrompt />
        {children}
      </DashboardAuthGuard>
    </Suspense>
  );
}
