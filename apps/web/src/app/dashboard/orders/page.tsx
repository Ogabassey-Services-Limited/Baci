import { getMerchantForUser } from '@/lib/merchant-server';
import { getOrderStats, getOrders } from './actions';
import OrdersClientPage from './client-page';

export const metadata = {
  title: 'Orders - Baci',
};

export default async function OrdersPage() {
  const { merchant } = await getMerchantForUser();

  if (!merchant) {
    return <OrdersClientPage />;
  }

  // Use Promise.allSettled to handle partial failures gracefully
  const results = await Promise.allSettled([
    getOrders(merchant.id),
    getOrderStats(merchant.id),
  ]);

  const orders = results[0].status === 'fulfilled' ? results[0].value : [];
  const initialOrdersError =
    results[0].status === 'rejected' ? 'Could not load orders.' : null;
  const stats =
    results[1].status === 'fulfilled' ? results[1].value : undefined;

  // Log any errors for debugging
  if (results[0].status === 'rejected') {
    console.error('Failed to fetch orders:', results[0].reason);
  }
  if (results[1].status === 'rejected') {
    console.error('Failed to fetch order stats:', results[1].reason);
  }

  return (
    <OrdersClientPage
      initialOrders={orders}
      initialOrdersError={initialOrdersError}
      initialStats={stats}
    />
  );
}
