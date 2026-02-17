import { ChevronLeft, Receipt } from 'lucide-react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getMerchantForUser } from '@/lib/merchant-server';
import { createClient } from '@/lib/supabase/server';
import { TaxSettingsForm } from './tax-settings-form';

export const metadata: Metadata = {
  title: 'Tax Settings | Baci',
  description: 'Configure VAT and tax settings for your store.',
};

export default async function TaxSettingsPage() {
  const { merchant } = await getMerchantForUser();

  if (!merchant) {
    redirect('/login');
  }

  // Fetch current VAT settings
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: merchantData } = await supabase
    .from('merchants')
    .select(
      'vat_registration_status, vat_rate, tax_identification_number, legal_entity_name, registered_address, state_code'
    )
    .eq('id', merchant.id)
    .single();

  const vatEnabled = merchantData?.vat_registration_status === 'registered';
  const vatRate = merchantData?.vat_rate ?? 7.5;
  const taxId = merchantData?.tax_identification_number ?? '';
  const legalEntityName = merchantData?.legal_entity_name ?? '';
  const addr = merchantData?.registered_address as Record<
    string,
    string
  > | null;
  const registeredAddress = {
    street: addr?.street ?? '',
    city: addr?.city ?? '',
    state: addr?.state ?? '',
    postal_code: addr?.postal_code ?? '',
  };
  const stateCode = (merchantData?.state_code as string) ?? '';

  return (
    <div className="grid gap-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/settings">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Receipt className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Tax Settings</h1>
            <p className="text-muted-foreground text-sm">
              Configure VAT, tax identification, and registered address
            </p>
          </div>
        </div>
      </div>

      <TaxSettingsForm
        merchantId={merchant.id}
        initialVatEnabled={vatEnabled}
        initialVatRate={vatRate}
        initialTaxId={taxId}
        initialLegalEntityName={legalEntityName}
        initialRegisteredAddress={registeredAddress}
        initialStateCode={stateCode}
      />
    </div>
  );
}
