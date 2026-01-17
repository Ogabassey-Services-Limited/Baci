import { type ReactNode, Suspense } from 'react';
import { DashboardAuthGuard } from './auth-guard';
import DashboardLoading from './loading';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardAuthGuard>{children}</DashboardAuthGuard>
    </Suspense>
  );
}
