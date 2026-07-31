import type { RegisteredAddress } from '@baci/shared';
import { ChevronLeft, Receipt } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { isBaciPaystackSettlementCountry } from '@/lib/checkout/payment-gateway-availability';
import {
  ensurePermission,
  isMerchantPermissionRedirectError,
} from '@/lib/merchant-server';
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
  // the tax/legal payload. Accept a settings VIEWER or EDITOR: `edit` does not
  // imply `view` in this app, and the tax form persists via /api/merchant/settings
  // which authorizes `settings.edit`, so an editor must be able to reach it.
  let merchant: Awaited<ReturnType<typeof ensurePermission>>['merchant'];
  try {
    ({ merchant } = await ensurePermission('settings', 'view'));
  } catch (viewError) {
    if (!isMerchantPermissionRedirectError(viewError)) {
      // Unexpected errors (auth service outage, bugs) must surface.
      throw viewError;
    }
    try {
      ({ merchant } = await ensurePermission('settings', 'edit'));
    } catch (editError) {
      if (isMerchantPermissionRedirectError(editError)) {
        redirect('/dashboard');
      }
      throw editError;
    }
  }

  // ensurePermission resolves its merchant through the caller-bound dashboard
  // RPC, whose settings projection contains these tax/legal fields. Do not add
  // a service-role read to this user-facing page.
  const vatEnabled = merchant.vat_registration_status === 'registered';
  const vatRate = merchant.vat_rate ?? 7.5;
  const taxId = merchant.tax_identification_number ?? '';
  const legalEntityName = merchant.legal_entity_name ?? '';
  const parsedAddress = registeredAddressSchema.safeParse(
    merchant.registered_address
  );
  if (!parsedAddress.success && merchant.registered_address != null) {
    console.error('Invalid merchant registered address payload:', {
      merchantId: merchant.id,
      address: merchant.registered_address,
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
  const stateCode = merchant.state_code ?? '';

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

      {isBaciPaystackSettlementCountry(merchant.country) ? (
        <TaxSettingsForm
          key={merchant.id}
          merchantId={merchant.id}
          initialVatEnabled={vatEnabled}
          initialVatRate={vatRate}
          initialTaxId={taxId}
          initialLegalEntityName={legalEntityName}
          initialRegisteredAddress={registeredAddress}
          initialStateCode={stateCode}
        />
      ) : (
        <p
          className="rounded-lg border border-border bg-muted p-4 text-sm"
          role="alert"
        >
          Tax settings are only available for Nigerian merchants.
        </p>
      )}
    </div>
  );
}
