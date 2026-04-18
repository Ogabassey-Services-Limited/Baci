import type { Metadata } from 'next';
import { Suspense } from 'react';
import LoginClient from '@/app/login/login-client';
import LoginLoadingFallback from '@/app/login/login-loading-fallback';

export const metadata: Metadata = {
  title: 'Login - Access Your Dashboard | Baci',
  description:
    'Log in to your Baci dashboard to manage your store, products, and orders. Secure access for business owners.',
};

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoadingFallback />}>
      <LoginClient />
    </Suspense>
  );
}
