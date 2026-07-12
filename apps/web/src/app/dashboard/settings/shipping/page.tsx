import { ChevronLeft, Truck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { BagLoader } from '@/components/ui/bag-loader';
import { Button } from '@/components/ui/button';
import { getMerchantForUser } from '@/lib/merchant-server';
import { listShippingConfig } from './actions';
import { ShippingClient } from './shipping-client';

export const metadata: Metadata = {
  title: 'Shipping Rates | Baci',
  description:
    'Set up delivery zones and rates so customers can check out anywhere.',
};

async function ShippingContent() {
  const { zones, rates, currencyCode, currencySymbol } =
    await listShippingConfig();

  return (
    <ShippingClient
      initialZones={zones}
      initialRates={rates}
      currencyCode={currencyCode}
      currencySymbol={currencySymbol}
    />
  );
}

export default async function ShippingSettingsPage() {
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
            <ChevronLeft className="size-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Truck className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Shipping Rates
            </h1>
            <p className="text-sm text-muted-foreground">
              Configure delivery zones, fees, and pickup options.
            </p>
          </div>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="flex items-center justify-center h-full py-12">
            <BagLoader size={32} />
          </div>
        }
      >
        <ShippingContent />
      </Suspense>
    </div>
  );
}
