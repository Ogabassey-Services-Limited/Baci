import LoginClient from '@/app/(auth)/login/login-client';
import {
  DEFAULT_AUTH_REDIRECT_PATH,
  sanitizeRelativeRedirectPath,
} from '@/lib/auth-redirect';
import { getFirstSearchParam } from '@/lib/search-params';

export type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function LoginPageContent({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const defaultEmail = getFirstSearchParam(params.email) ?? '';
  const redirectTo = sanitizeRelativeRedirectPath(
    getFirstSearchParam(params.redirect) ??
      getFirstSearchParam(params.redirectTo),
    DEFAULT_AUTH_REDIRECT_PATH
  );

  return <LoginClient defaultEmail={defaultEmail} redirectTo={redirectTo} />;
}
