import type { Metadata } from 'next';
import LoginClient from '@/app/login/login-client';
import {
  DEFAULT_AUTH_REDIRECT_PATH,
  sanitizeRelativeRedirectPath,
} from '@/lib/auth-redirect';
import { getFirstSearchParam } from '@/lib/search-params';

export const metadata: Metadata = {
  title: 'Login - Access Your Dashboard | Baci',
  description:
    'Log in to your Baci dashboard to manage your store, products, and orders. Secure access for business owners.',
  robots: { index: false, follow: false },
};

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const defaultEmail = getFirstSearchParam(params.email) ?? '';
  const redirectTo = sanitizeRelativeRedirectPath(
    getFirstSearchParam(params.redirect) ??
      getFirstSearchParam(params.redirectTo),
    DEFAULT_AUTH_REDIRECT_PATH
  );

  return <LoginClient defaultEmail={defaultEmail} redirectTo={redirectTo} />;
}
