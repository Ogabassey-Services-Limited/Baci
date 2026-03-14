import { redirect } from 'next/navigation';
import { getMerchantForUser } from '@/lib/merchant-server';
import { KycForm } from './kyc-form';

export default async function KycSettingsPage() {
  try {
    const { merchant } = await getMerchantForUser();

    if (!merchant) {
      redirect('/login');
    }

    // Cast merchant to access KYC fields which may be missing in shared type
    // effectively relying on the select('*') in getMerchantForUser to return all DB columns
    const m = merchant as unknown as {
      nin?: string;
      bvn?: string;
      cac_rc_number?: string;
      kyc_status?: 'pending' | 'verified' | 'rejected' | null;
    };

    const initialData = {
      nin: m.nin || '',
      bvn: m.bvn || '',
      cac_number: m.cac_rc_number || '',
      kyc_status: m.kyc_status || null,
    };

    return (
      <div className="container max-w-2xl py-8">
        <KycForm initialData={initialData} />
      </div>
    );
  } catch (error) {
    console.error('KYC Page Error:', error);
    return (
      <div className="container max-w-2xl py-8">
        <div className="p-6 bg-destructive/10 border border-destructive/20 rounded-lg">
          <h2 className="text-lg font-semibold text-destructive mb-2">
            Unable to load KYC settings
          </h2>
          <p className="text-sm text-muted-foreground">
            There was an error loading your verification details. Please try
            refreshing the page or contact support if the issue persists.
          </p>
        </div>
      </div>
    );
  }
}
