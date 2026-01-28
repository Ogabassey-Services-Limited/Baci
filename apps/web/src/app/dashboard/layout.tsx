import { type ReactNode, Suspense } from 'react';
import { DashboardAuthGuard } from './auth-guard';
import DashboardLoading from './loading';

/**
 * Dashboard Layout - Auth handling with Suspense
 *
 * Pattern: Suspense boundary around async auth check
 * - DashboardLoading: Shows skeleton while auth resolves
 * - DashboardAuthGuard: Async auth check + redirects
 * - DashboardClientLayout (in providers.tsx): Interactive sidebar
 *
 * Note: The sidebar is a client component because it has interactive state
 * (collapse, route highlighting). The PPR static shell pattern is better
 * suited for content-heavy pages with predictable layouts.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardAuthGuard>{children}</DashboardAuthGuard>
    </Suspense>
  );
}
