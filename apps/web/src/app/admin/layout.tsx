import { redirect } from 'next/navigation';
import { type ReactNode, Suspense } from 'react';
import { CsrfInitializer } from '@/components/csrf-initializer';
import { getPlatformAdminAuth } from '@/lib/platform-admin-auth';
import { AdminShell } from './admin-shell';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AdminLayoutFallback />}>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </Suspense>
  );
}

/** Exported so layout tests can exercise resolved auth and redirect paths. */
export async function AdminLayoutContent({
  children,
}: {
  children: ReactNode;
}) {
  const auth = await getPlatformAdminAuth();

  if (auth.status === 'unauthenticated') {
    redirect('/login?redirect=%2Fadmin');
  }

  if (auth.status === 'forbidden') {
    redirect('/dashboard');
  }

  return (
    <>
      <CsrfInitializer />
      <AdminShell adminEmail={auth.user.email}>{children}</AdminShell>
    </>
  );
}

function AdminLayoutFallback() {
  return (
    <div
      className="min-h-screen bg-background text-foreground"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Loading admin workspace</span>
    </div>
  );
}
