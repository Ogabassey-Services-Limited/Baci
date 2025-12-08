'use client';

import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';

// ssr: false is intentional - auth pages don't need SSR for crawlers
const LoginForm = dynamic(() => import('@/components/login-form'), {
  ssr: false,
  loading: () => (
    <output
      className="flex min-h-screen items-center justify-center"
      aria-label="Loading login form"
    >
      <Loader2
        className="h-8 w-8 animate-spin text-primary"
        aria-hidden="true"
      />
    </output>
  ),
});

export default function LoginClient() {
  return <LoginForm />;
}
