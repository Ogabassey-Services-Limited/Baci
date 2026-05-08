import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { CsrfInitializer } from '@/components/csrf-initializer';
import { getPlatformAdminAuth } from '@/lib/platform-admin-auth';
import { AdminShell } from './admin-shell';

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const auth = await getPlatformAdminAuth();

  if (auth.status === 'unauthenticated') {
    redirect('/login?redirectTo=%2Fadmin');
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
