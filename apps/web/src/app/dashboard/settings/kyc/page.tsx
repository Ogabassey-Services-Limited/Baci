import { redirect } from 'next/navigation';
import { getMerchantForUser } from '@/lib/merchant-server';
import { KycForm } from './kyc-form';

export default async function KycSettingsPage() {
  const { merchant } = await getMerchantForUser();

  if (!merchant) {
    redirect('/login');
  }

  // Cast merchant to access KYC fields which may be missing in shared type
  // effectively relying on the select('*') in getMerchantForUser to return all DB columns
  // biome-ignore lint/suspicious/noExplicitAny: KYC fields may be missing in shared MerchantData type
  const m = merchant as any;

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
}
