'use client';

import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';

// Enable SSR for faster initial paint (form renders on server)
const LoginForm = dynamic(() => import('@/components/login-form'), {
  loading: () => (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 motion-safe:animate-spin" />
    </div>
  ),
});

export default function LoginClient() {
  return <LoginForm />;
}
