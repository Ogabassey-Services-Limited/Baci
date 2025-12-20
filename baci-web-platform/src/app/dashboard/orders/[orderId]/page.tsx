import { notFound } from 'next/navigation';
import { getMerchantForUser } from '@/lib/merchant-server';
import { getOrder, type Order } from '../actions';
import OrderDetailsClientPage from './client-page';

export const metadata = {
  title: 'Order Details - Baci',
};

type Props = {
  params: Promise<{ orderId: string }>;
};

export default async function OrderDetailsPage({ params }: Props) {
  const { orderId } = await params;
  const { merchant } = await getMerchantForUser();

  if (!merchant) {
    return notFound();
  }

  let order: Order | null;
  try {
    order = await getOrder(merchant.id, orderId);
  } catch (error) {
    console.error('Failed to fetch order:', error);
    return notFound();
  }

  if (!order) {
    return notFound();
  }

  return <OrderDetailsClientPage initialOrder={order} />;
}
