'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type React from 'react';
import { useState, useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { EmptyState } from '../components/empty-state';
import { OrderItemsList } from '../components/order-items-list';
import { OrderSummarySidebar } from '../components/order-summary-sidebar';
import { useCustomerAuth } from '@/contexts/customer-auth-context';
import { useStoreSlug } from '@/hooks/use-store-slug';
import { getStatusColor, getStatusIcon } from '@/lib/order-status-utils';
import { createClient } from '@/lib/supabase/client';
import type { StorefrontOrder } from '@/types/storefront-order';
import type { PaymentStatus, ShippingStatus } from '@baci/shared/types';

/** Valid values for runtime checks on realtime payloads. */
const VALID_SHIPPING_STATUSES: readonly string[] = [
  'pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned',
];
const VALID_PAYMENT_STATUSES: readonly string[] = [
  'paid', 'unpaid', 'pending', 'failed', 'refunded', 'partially_paid',
  'bnpl_approved', 'bnpl_pending',
];

export const OgabasseyV2OrderDetails: React.FC = () => {
  const params = useParams();
  const { customer: _customer, isAuthenticated: _isAuthenticated } = useCustomerAuth();
  const storeSlug = useStoreSlug();
  const getUrl = (path: string): string => storeSlug ? `/${storeSlug}${path}` : path;
  const router = useRouter();

  const [order, setOrder] = useState<StorefrontOrder | null>(null);
  const [loading, setLoading] = useState(true);

  // Realtime subscription channel ref for cleanup
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Fetch Order
  useEffect(() => {
    const fetchOrder = async () => {
      const orderId = params?.id;
      if (!orderId) return;

      setLoading(true);
      try {
        const res = await fetch(`/api/storefront/orders/${orderId}`);
        if (!res.ok) {
          throw new Error('Order not found');
        }
        const data: unknown = await res.json();
        if (data !== null && typeof data === 'object' && 'id' in data && 'items' in data) {
          setOrder(data as StorefrontOrder);
        } else {
          throw new Error('Unexpected order response shape');
        }
      } catch (err) {
        console.error('Failed to fetch order', err);
        setOrder(null);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [params?.id]);

  // Supabase Realtime subscription for live order status updates
  // Matches mobile app functionality for feature parity
  useEffect(() => {
    const orderId = params?.id;
    if (!orderId || typeof orderId !== 'string') return;

    const supabase = createClient();

    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          const newData = payload.new as Record<string, unknown>;
          if (newData) {
            setOrder((prevOrder) => {
              if (!prevOrder) return prevOrder;
              return {
                ...prevOrder,
                shipping_status:
                  typeof newData.shipping_status === 'string' &&
                  VALID_SHIPPING_STATUSES.includes(newData.shipping_status)
                    ? (newData.shipping_status as ShippingStatus)
                    : prevOrder.shipping_status,
                payment_status:
                  typeof newData.payment_status === 'string' &&
                  VALID_PAYMENT_STATUSES.includes(newData.payment_status)
                    ? (newData.payment_status as PaymentStatus)
                    : prevOrder.payment_status,
                tracking_number:
                  typeof newData.tracking_number === 'string'
                    ? newData.tracking_number
                    : prevOrder.tracking_number,
                tracking_url:
                  typeof newData.tracking_url === 'string'
                    ? newData.tracking_url
                    : prevOrder.tracking_url,
                updated_at:
                  typeof newData.updated_at === 'string'
                    ? newData.updated_at
                    : prevOrder.updated_at,
              };
            });
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
    };
  }, [params?.id]);

  const handleBuyAgain = () => {
    if (order?.items?.[0]) {
      router.push(getUrl(`/product/${order.items[0].product_id}`));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center pt-20">
        <div
          className="animate-spin rounded-full h-8 w-8 border-b-2"
          style={{ borderColor: 'var(--store-primary, #dc2626)' }}
        />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center pt-20">
        <EmptyState
          title="Order Not Found"
          description="We couldn't find the order you are looking for."
          actionLabel="Back to Orders"
          actionLink={getUrl('/account/orders')}
          variant="generic"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-12 pt-4 md:pt-8 flex flex-col">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 w-full flex-1 flex flex-col">
        {/* Breadcrumb / Back */}
        <div className="flex items-center gap-4 mb-6">
          <Link
            href={getUrl('/account/orders')}
            className="p-2 hover:bg-white rounded-full transition-colors text-gray-500 hover:text-gray-900 border border-transparent hover:border-gray-200"
          >
            <ChevronLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Order Details</h1>
            <p className="text-xs text-gray-500">
              #{order.order_number || order.id.slice(0, 8)} &bull;{' '}
              {new Date(order.created_at || Date.now()).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Status Card */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-900">Order Status</h2>
                <span
                  className={`text-xs font-bold px-3 py-1 rounded-full border flex items-center gap-1.5 uppercase tracking-wide ${getStatusColor(order.shipping_status || 'Pending')}`}
                >
                  {getStatusIcon(order.shipping_status || 'Pending')}{' '}
                  {order.shipping_status || 'Pending'}
                </span>
              </div>
              {/* Progress Bar */}
              <div className="relative pt-4 pb-2">
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      order.shipping_status === 'delivered'
                        ? 'bg-green-500 w-full'
                        : order.shipping_status === 'shipped'
                          ? 'bg-blue-500 w-2/3'
                          : order.shipping_status === 'processing'
                            ? 'bg-amber-500 w-1/3'
                            : 'bg-gray-300 w-1/12'
                    }`}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-bold text-gray-400 mt-2 uppercase tracking-wide">
                  <span>Placed</span>
                  <span>Processing</span>
                  <span>Shipped</span>
                  <span>Delivered</span>
                </div>
              </div>
            </div>

            <OrderItemsList items={order.items} getUrl={getUrl} />
          </div>

          <OrderSummarySidebar order={order} onBuyAgain={handleBuyAgain} />
        </div>
      </div>
    </div>
  );
};
