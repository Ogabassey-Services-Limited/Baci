import { type ReactNode, Suspense } from 'react';
import '@/app/globals.css';
import { DashboardAuthGuard } from './auth-guard';
import DashboardLoading from './loading';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardAuthGuard>{children}</DashboardAuthGuard>
    </Suspense>
  );
}
