'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

// ssr: false is intentional - auth pages don't need SSR for crawlers
const LoginForm = dynamic(() => import('@/components/login-form'), {
  ssr: false,
  loading: () => (
    <div
      className="flex min-h-screen items-center justify-center"
      role="status"
      aria-label="Loading login form"
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
    </div>
  ),
});

export default function LoginClient() {
  return <LoginForm />;
}
