import { redirect } from 'next/navigation';
import { getMerchantForUser } from '@/lib/merchant-server';
import { asRoute } from '@/lib/routes';
import ChannelsClientPage from './client-page';

export const metadata = {
  title: 'Marketplaces | Baci',
  description: 'Connect marketplaces to sell on multiple platforms from Baci.',
};

export default async function ChannelsPage() {
  const { merchant } = await getMerchantForUser();

  if (!merchant) {
    redirect(asRoute('/login'));
  }

  return <ChannelsClientPage />;
}
