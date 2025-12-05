import { notFound } from 'next/navigation';
import { getMerchantForUser } from '@/lib/merchant-server';
import { getCustomer, getCustomerOrders } from '../actions';
import CustomerDetailClientPage from './client-page';

export const metadata = {
  title: 'Customer Details - Baci',
};

type Props = {
  params: Promise<{ id: string }>;
};

export default async function CustomerDetailPage({ params }: Props) {
  const { id } = await params;
  const { merchant } = await getMerchantForUser();

  if (!merchant) {
    return notFound();
  }

  // Use Promise.allSettled to handle partial failures gracefully
  // Note: getCustomer and getCustomerOrders already include merchant_id verification
  const results = await Promise.allSettled([
    getCustomer(id),
    getCustomerOrders(id),
  ]);

  const customer = results[0].status === 'fulfilled' ? results[0].value : null;
  const orders = results[1].status === 'fulfilled' ? results[1].value : [];

  // Log any errors for debugging
  if (results[0].status === 'rejected') {
    console.error('Failed to fetch customer:', results[0].reason);
  }
  if (results[1].status === 'rejected') {
    console.error('Failed to fetch customer orders:', results[1].reason);
  }

  if (!customer) {
    return notFound();
  }

  return (
    <CustomerDetailClientPage
      initialCustomer={customer}
      initialOrders={orders}
    />
  );
}
