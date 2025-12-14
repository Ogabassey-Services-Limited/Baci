import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getTransactions, getWalletData } from './actions';
import WalletClient from './wallet-client';

export const metadata = {
  title: 'Wallet | Dashboard',
  description: 'Manage your earnings and withdrawals',
};

export default async function WalletPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const { data: merchant } = await supabase
    .from('merchants')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!merchant) {
    redirect('/onboarding');
  }

  // Fetch data in parallel
  const [walletData, transactions] = await Promise.all([
    getWalletData(merchant.id),
    getTransactions(merchant.id),
  ]);

  return (
    <WalletClient
      wallet={walletData?.wallet || null}
      pendingSettlements={walletData?.pendingSettlements || []}
      transactions={transactions}
      merchantId={merchant.id}
    />
  );
}
