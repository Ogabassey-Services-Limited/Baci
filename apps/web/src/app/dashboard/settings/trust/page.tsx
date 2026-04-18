import { ChevronLeft, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getMerchantForUser } from '@/lib/merchant-server';
import { TrustSettingsClient } from './trust-settings-client';

export const metadata: Metadata = {
  title: 'Trust & Policies | Baci',
  description: 'Manage store trust signals, support details, and policies.',
};

export default async function TrustSettingsPage() {
  const { merchant } = await getMerchantForUser();

  if (!merchant) {
    redirect('/login');
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          asChild
          aria-label="Back to settings"
        >
          <Link href="/dashboard/settings">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Trust & Policies
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage support details and trust-facing policy summaries.
            </p>
          </div>
        </div>
      </div>

      <TrustSettingsClient
        initialTrustProfile={merchant.trust_profile ?? null}
      />
    </div>
  );
}
