import type { Metadata } from 'next';
import { Suspense } from 'react';
import LoginClient from '@/app/login/login-client';

export const metadata: Metadata = {
  title: 'Login - Access Your Dashboard | Baci',
  description:
    'Log in to your Baci dashboard to manage your store, products, and orders. Secure access for business owners.',
};

function LoginLoadingFallback() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex min-h-[50vh] items-center justify-center"
      role="status"
    >
      <span className="sr-only">Loading login…</span>
      <div
        aria-hidden="true"
        className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary"
      />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoadingFallback />}>
      <LoginClient />
    </Suspense>
  );
}
