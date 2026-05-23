import '@/app/globals.css';
import { Loader2 } from 'lucide-react';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import VerifyForm from '@/components/auth/verify-form';

export const metadata: Metadata = {
  title: 'Verify Email - Baci',
  description: 'Verify your email address to secure your account.',
};

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <VerifyForm />
    </Suspense>
  );
}
