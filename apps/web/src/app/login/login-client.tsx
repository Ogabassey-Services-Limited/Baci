// Required because LoginForm uses client-side state, actions, and form interactions.
'use client';

import LoginForm from '@/components/login-form';
import {
  DEFAULT_AUTH_REDIRECT_PATH,
  sanitizeRelativeRedirectPath,
} from '@/lib/auth-redirect';

export type LoginClientProps = {
  defaultEmail?: string;
  redirectTo?: string;
};

export default function LoginClient({
  defaultEmail = '',
  redirectTo = DEFAULT_AUTH_REDIRECT_PATH,
}: LoginClientProps) {
  return (
    <LoginForm
      defaultEmail={defaultEmail}
      redirectTo={sanitizeRelativeRedirectPath(redirectTo)}
    />
  );
}
