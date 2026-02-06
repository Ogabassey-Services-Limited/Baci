'use client';

import { ArrowRight, CheckCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useMerchantSafe } from '@/hooks/use-merchant';
import { asRoute } from '@/lib/routes';

interface OrderData {
  id: string;
  order_number: string;
  tracking_token?: string;
  shipping: {
    firstName: string;
    lastName: string;
    email: string;
    address: string;
    city: string;
    state: string;
  };
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    image: string;
  }>;
  subtotal: number;
  shipping_fee: number;
  total: number;
}

import { GoogleCustomerReviews } from '@/components/analytics/google-customer-reviews';
import { useAuthSafe } from '@/contexts/auth-context';

function OrderSuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const _type = searchParams.get('type'); // Reserved for future use
  const merchantContext = useMerchantSafe();
  const basePath = merchantContext?.basePath;
  const merchant = merchantContext?.merchant;
  const auth = useAuthSafe();
  const user = auth?.user;

  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);

  // Helper for dynamic links
  const getHref = (path: string) =>
    path.startsWith('http')
      ? path
      : `${basePath || ''}${path === '/' ? '' : path}`;

  useEffect(() => {
    async function fetchOrder() {
      if (!orderId) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/orders/${orderId}`);
        if (res.ok) {
          const data = await res.json();
          setOrder(data.order);
        }
      } catch (err) {
        console.error('Failed to fetch order', err);
      } finally {
        setLoading(false);
      }
    }

    fetchOrder();
  }, [orderId]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400 mb-4" />
        <p className="text-gray-500">Loading order details...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 pt-10">
      {/* Google Customer Reviews Opt-in */}
      {merchant && order && order.shipping?.email && (
        <GoogleCustomerReviews
          merchant={merchant}
          orderId={order.id}
          email={order.shipping.email}
          // Default to 5 days for delivery logic if not available
          deliveryDate={
            new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split('T')[0]
          }
          country="NG"
        />
      )}

      <div className="max-w-xl mx-auto px-4">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Order Confirmed!
          </h1>
          <p className="text-gray-500 mb-8">
            Thank you for your purchase. Your order has been received.
          </p>

          {order && (
            <div className="text-left bg-gray-50 rounded-2xl p-6 mb-8 border border-gray-100">
              <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200">
                <span className="text-sm font-medium text-gray-500">
                  Order Number
                </span>
                <span className="font-bold text-gray-900">
                  #{order.order_number || order.id.slice(0, 8)}
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <span className="text-sm font-medium text-gray-500">
                    Items ({order.items?.length || 0})
                  </span>
                  <span className="font-medium text-gray-900">
                    {new Intl.NumberFormat('en-NG', {
                      style: 'currency',
                      currency: 'NGN',
                    }).format(order.total)}
                  </span>
                </div>
                {order.shipping?.email && (
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-medium text-gray-500">
                      Email
                    </span>
                    <span className="font-medium text-gray-900 truncate max-w-[200px]">
                      {order.shipping.email}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <Link
              href={asRoute(getHref('/'))}
              className="inline-flex items-center justify-center gap-2 px-6 py-4 bg-black text-white font-bold rounded-xl hover:bg-gray-800 transition-colors w-full"
            >
              Continue Shopping
              <ArrowRight size={18} />
            </Link>

            {user ? (
              <Link
                href={asRoute(getHref('/account/orders'))}
                className="inline-flex items-center justify-center gap-2 px-6 py-4 bg-white text-gray-900 font-bold rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors w-full"
              >
                View My Orders
              </Link>
            ) : order?.tracking_token ? (
              <Link
                href={asRoute(
                  getHref(
                    `/track-order?token=${encodeURIComponent(order.tracking_token)}`
                  )
                )}
                className="inline-flex items-center justify-center gap-2 px-6 py-4 bg-white text-gray-900 font-bold rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors w-full"
              >
                Track My Order
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="animate-spin" />
        </div>
      }
    >
      <OrderSuccessContent />
    </Suspense>
  );
}
