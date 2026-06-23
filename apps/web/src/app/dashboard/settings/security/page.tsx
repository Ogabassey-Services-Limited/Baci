import { ChevronLeft, Shield } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getMerchantForUser } from '@/lib/merchant-server';
import { PasskeySecurityCard } from './passkey-security-card';
import { SecurityForm } from './security-form';

export const metadata: Metadata = {
  title: 'Account Security | Baci',
  description: 'Manage your account password and security settings.',
};

export default async function SecuritySettingsPage() {
  const { merchant } = await getMerchantForUser();

  if (!merchant) {
    redirect('/login');
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/settings">
            <ChevronLeft className="size-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Shield className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Account Security
            </h1>
            <p className="text-muted-foreground text-sm">
              Manage your password and account security
            </p>
          </div>
        </div>
      </div>

      <SecurityForm />
      {process.env.NEXT_PUBLIC_SUPABASE_PASSKEY_AUTH_ENABLED === 'true' && (
        <PasskeySecurityCard />
      )}
    </div>
  );
}
