import { redirect } from 'next/navigation';
import { getMerchantForUser } from '@/lib/merchant-server';
import { KycForm } from './kyc-form';

export default async function KycSettingsPage() {
  const { merchant } = await getMerchantForUser();

  if (!merchant) {
    redirect('/login');
  }

  // Cast merchant to any to avoid potential type issues if KYC fields are missing in the shared type
  // effectively relying on the select('*') in getMerchantForUser to return all DB columns
  const m = merchant as any;

  const initialData = {
    nin: m.nin || '',
    bvn: m.bvn || '',
    cac_number: m.cac_number || '',
    kyc_status: m.kyc_status || null,
  };

  return (
    <div className="container max-w-2xl py-8">
      <KycForm initialData={initialData} />
    </div>
  );
}
