import { getMerchantForUser } from '@/lib/merchant-server';
import { getCustomers } from './actions';
import CustomersClientPage from './client-page';

export const metadata = {
  title: 'Customers - Baci',
};

export default async function CustomersPage() {
  const { merchant } = await getMerchantForUser();

  if (!merchant) {
    return <CustomersClientPage />;
  }

  let customers: Awaited<ReturnType<typeof getCustomers>>;
  try {
    customers = await getCustomers(merchant.id);
  } catch (error) {
    console.error('Failed to fetch customers:', error);
    customers = [];
  }

  return <CustomersClientPage initialCustomers={customers} />;
}
