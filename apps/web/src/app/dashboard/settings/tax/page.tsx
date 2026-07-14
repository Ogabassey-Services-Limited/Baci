import {
  MERCHANT_TAX_SETTINGS_COLUMNS,
  type RegisteredAddress,
} from '@baci/shared';
import { ChevronLeft, Receipt } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  ensurePermission,
  isMerchantPermissionRedirectError,
} from '@/lib/merchant-server';
import { createAdminClient } from '@/lib/supabase/admin';
import { registeredAddressSchema } from '@/schemas/merchant-settings';
import { TaxSettingsForm } from './tax-settings-form';

export const metadata: Metadata = {
  title: 'Tax Settings | Baci',
  description: 'Configure VAT and tax settings for your store.',
};

export default async function TaxSettingsPage() {
  // Gate on the settings permission BEFORE the service-role read below. The
  // admin client bypasses RLS/column grants, so this page must not rely on the
  // DB to keep a low-privilege staff member (without `settings` access) out of
  // the tax/legal payload — ensurePermission throws for owner/staff who lack it.
  let merchant: Awaited<ReturnType<typeof ensurePermission>>['merchant'];
  try {
    ({ merchant } = await ensurePermission('settings', 'view'));
  } catch (error) {
    // Only known auth/permission failures redirect; unexpected errors (auth
    // service outage, bugs) must surface, not silently bounce to /dashboard.
    if (isMerchantPermissionRedirectError(error)) {
      redirect('/dashboard');
    }
    throw error;
  }

  // Fetch current VAT/registration settings. Permission + merchant ownership are
  // verified above; this read runs under the service role so it keeps working
  // after S1 revokes the sensitive `merchants` column grants from the
  // `authenticated` role.
  const supabase = createAdminClient();

  const { data: merchantData, error: merchantDataError } = await supabase
    .from('merchants')
    .select(MERCHANT_TAX_SETTINGS_COLUMNS)
    .eq('id', merchant.id)
    .single();

  if (merchantDataError) {
    console.error('Failed to load merchant tax settings:', merchantDataError);
    throw new Error('Unable to load merchant data');
  }

  const vatEnabled = merchantData?.vat_registration_status === 'registered';
  const vatRate = merchantData?.vat_rate ?? 7.5;
  const taxId = merchantData?.tax_identification_number ?? '';
  const legalEntityName = merchantData?.legal_entity_name ?? '';
  const parsedAddress = registeredAddressSchema.safeParse(
    merchantData?.registered_address
  );
  if (!parsedAddress.success && merchantData?.registered_address != null) {
    console.error('Invalid merchant registered address payload:', {
      merchantId: merchant.id,
      address: merchantData.registered_address,
      error: parsedAddress.error,
    });
  }
  const addr: RegisteredAddress | null = parsedAddress.success
    ? parsedAddress.data
    : null;
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
            <ChevronLeft className="size-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Receipt className="size-5 text-primary" />
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
