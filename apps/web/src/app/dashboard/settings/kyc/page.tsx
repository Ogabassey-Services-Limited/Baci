import { Lock, Shield } from 'lucide-react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { MerchantData } from '@/hooks/merchant';
import { isBaciPaystackSettlementCountry } from '@/lib/checkout/payment-gateway-availability';
import { getMerchantForUser } from '@/lib/merchant-server';
import { createClient } from '@/lib/supabase/server';
import { KycVerification, type KycVerificationProps } from './kyc-verification';

type KycPageView =
  | { kind: 'login-redirect' }
  | { kind: 'staff-blocked' }
  | { kind: 'not-required' }
  | { kind: 'status-error' }
  | { kind: 'load-error' }
  | {
      kind: 'ready';
      merchant: MerchantData;
      status: KycVerificationProps['verificationStatus'];
    };

export default async function KycSettingsPage() {
  await connection();

  let view: KycPageView;

  try {
    const { merchant, staffAccess } = await getMerchantForUser();

    if (!merchant) {
      view = { kind: 'login-redirect' };
    } else if (!staffAccess?.isOwner) {
      view = { kind: 'staff-blocked' };
    } else if (!isBaciPaystackSettlementCountry(merchant.country)) {
      view = { kind: 'not-required' };
    } else {
      const cookieStore = await cookies();
      const supabase = createClient(cookieStore);
      const { data: status, error } = await supabase.rpc(
        'get_merchant_verification_status',
        { p_merchant_id: merchant.id }
      );

      if (error) {
        console.error('get_merchant_verification_status RPC failed:', error);
        view = { kind: 'status-error' };
      } else {
        view = { kind: 'ready', merchant, status };
      }
    }
  } catch (error) {
    console.error('KYC Page Error:', error);
    view = { kind: 'load-error' };
  }

  if (view.kind === 'login-redirect') {
    redirect('/login');
  }

  if (view.kind === 'staff-blocked') {
    return (
      <div className="container max-w-2xl py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Lock className="size-6 text-muted-foreground" />
              </div>
              <div>
                <CardTitle>KYC Verification</CardTitle>
                <CardDescription>
                  Only the store owner can verify identity. Contact your store
                  owner to complete KYC verification.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (view.kind === 'not-required') {
    return (
      <div className="container max-w-2xl py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Shield className="size-6 text-muted-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold leading-none tracking-tight">
                  Verification Not Required
                </h1>
                <CardDescription>
                  Additional identity verification is not required for stores
                  registered in your country. We will only ask for
                  provider-specific verification when it applies to your
                  selected settlement method.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (view.kind === 'status-error') {
    return (
      <div className="container max-w-2xl py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <Shield className="size-6 text-destructive" />
              </div>
              <div>
                <CardTitle>Unable to load verification status</CardTitle>
                <CardDescription>
                  Please refresh the page to try again.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (view.kind === 'load-error') {
    return (
      <div className="container max-w-2xl py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <Shield className="size-6 text-destructive" />
              </div>
              <div>
                <CardTitle>Unable to load KYC settings</CardTitle>
                <CardDescription>
                  There was an error loading your verification details. Please
                  try refreshing the page or contact support if the issue
                  persists.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-8">
      <KycVerification
        key={view.merchant.id}
        merchantId={view.merchant.id}
        verificationStatus={view.status}
        prefillNin={view.merchant.nin ?? null}
        prefillBvn={view.merchant.bvn ?? null}
        prefillRcNumber={view.merchant.cac_rc_number ?? null}
        prefillPhone={view.merchant.phone ?? null}
      />
    </div>
  );
}
