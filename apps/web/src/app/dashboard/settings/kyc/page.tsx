import { Lock, Shield } from 'lucide-react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getMerchantForUser } from '@/lib/merchant-server';
import { createClient } from '@/lib/supabase/server';
import { KycVerification } from './kyc-verification';

export default async function KycSettingsPage() {
  try {
    const { merchant, staffAccess } = await getMerchantForUser();

    if (!merchant) {
      redirect('/login');
    }

    if (!staffAccess.isOwner) {
      return (
        <div className="container max-w-2xl py-8">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Lock className="h-6 w-6 text-muted-foreground" />
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

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data: status, error } = await supabase.rpc(
      'get_merchant_verification_status',
      { p_merchant_id: merchant.id }
    );

    if (error) {
      console.error('get_merchant_verification_status RPC failed:', error);
      return (
        <div className="container max-w-2xl py-8">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <Shield className="h-6 w-6 text-destructive" />
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

    return (
      <div className="container max-w-2xl py-8">
        <KycVerification
          verificationStatus={status}
          prefillNin={merchant.nin ?? null}
          prefillBvn={merchant.bvn ?? null}
          prefillRcNumber={merchant.cac_rc_number ?? null}
          prefillPhone={merchant.phone ?? null}
        />
      </div>
    );
  } catch (error) {
    console.error('KYC Page Error:', error);
    return (
      <div className="container max-w-2xl py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <Shield className="h-6 w-6 text-destructive" />
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
}
