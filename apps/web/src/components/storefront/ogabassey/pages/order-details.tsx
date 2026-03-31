'use client';

import {
  CheckCircle2,
  ChevronLeft,
  Clock,
  CreditCard,
  Download,
  MapPin,
  Package,
  ShoppingBag,
  Truck,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import type React from 'react';
import { useState, useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { EmptyState } from '../components/empty-state';
import { useCustomerAuth } from '@/contexts/customer-auth-context';
import { getStorefrontOrderItemHref } from '@/lib/storefront-order-item-href';
import { createClient } from '@/lib/supabase/client';
import type { StorefrontOrder, StorefrontOrderItem } from '@/types/storefront-order';

// Hook to extract store slug from pathname
function useStoreSlug() {
  const pathname = usePathname();
  const pathSegments = pathname?.split('/').filter(Boolean) || [];
  const knownRoutes = ['account', 'cart', 'checkout', 'products', 'wishlist', 'wallet', 'repairs', 'imei-check', 'pages', 'orders'];
  const firstSegment = pathSegments[0] || '';
  return knownRoutes.includes(firstSegment) ? '' : firstSegment;
}

export const OgabasseyV2OrderDetails: React.FC = () => {
  const params = useParams(); // Get ID from URL
  const { customer: _customer, isAuthenticated: _isAuthenticated } = useCustomerAuth();
  const storeSlug = useStoreSlug();
  const getUrl = (path: string) => storeSlug ? `/${storeSlug}${path}` : path;
  const router = useRouter();

  const [order, setOrder] = useState<StorefrontOrder | null>(null);
  const [loading, setLoading] = useState(true);

  // Realtime subscription channel ref for cleanup
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Fetch Order
  useEffect(() => {
    const fetchOrder = async () => {
      // If we don't have an ID yet, or not authenticated (though page might be public-ish for guest checkout tracking, usually requires auth for 'My Orders')
      const orderId = params?.id;
      if (!orderId) return;

      setLoading(true);
      try {
        // Use the single order API endpoint
        const res = await fetch(`/api/storefront/orders/${orderId}`);
        if (!res.ok) {
          throw new Error('Order not found');
        }
        const data = await res.json();
        setOrder(data);
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

    // Create a unique channel for this order
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
          console.log('[Realtime] Order updated:', payload);

          // Update the order state with new data from realtime
          const newData = payload.new as Partial<StorefrontOrder>;
          if (newData) {
            setOrder((prevOrder) => {
              if (!prevOrder) return prevOrder;
              return {
                ...prevOrder,
                status: newData.status ?? prevOrder.status,
                shipping_status: newData.shipping_status ?? prevOrder.shipping_status,
                payment_status: newData.payment_status ?? prevOrder.payment_status,
                tracking_number: newData.tracking_number ?? prevOrder.tracking_number,
                tracking_url: newData.tracking_url ?? prevOrder.tracking_url,
                updated_at: newData.updated_at ?? prevOrder.updated_at,
              } as StorefrontOrder;
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status);
      });

    channelRef.current = channel;

    // Cleanup: unsubscribe on unmount to prevent memory leaks
    return () => {
      if (channelRef.current) {
        // Defensive check for unsubscribe existence (required for tests/mocks)
        channelRef.current.unsubscribe?.();
        channelRef.current = null;
      }
    };
  }, [params?.id]);

  const handleBuyAgain = () => {
    const firstItemHref = order?.items?.[0]
      ? getStorefrontOrderItemHref(order.items[0], storeSlug ? `/${storeSlug}` : '')
      : null;
    router.push((firstItemHref || getUrl('/products')) as any);
  };

  const getStatusColor = (status: string) => {
    const s = status?.toLowerCase();
    if (s === 'processing' || s === 'pending') return 'bg-blue-50 text-blue-600 border-blue-100';
    if (s === 'delivered') return 'bg-green-50 text-green-600 border-green-100';
    if (s === 'cancelled') return 'bg-red-50 text-red-600 border-red-100';
    if (s === 'shipped') return 'bg-amber-50 text-amber-600 border-amber-100';
    return 'bg-gray-50 text-gray-600 border-gray-100';
  };

  const getStatusIcon = (status: string) => {
    const s = status?.toLowerCase();
    if (s === 'processing' || s === 'pending') return <Clock size={16} />;
    if (s === 'delivered') return <CheckCircle2 size={16} />;
    if (s === 'cancelled') return <XCircle size={16} />;
    if (s === 'shipped') return <Truck size={16} />;
    return <Package size={16} />;
  };

  const PaymentDisplay = ({ provider }: { provider?: string }) => {
    if (!provider) return <span>Not Specified</span>;
    const p = provider.toLowerCase();

    // Use styled badges instead of external images (CDN URLs were breaking)
    // Color code by provider for visual distinction
    let bgColor = 'bg-gray-100';
    let textColor = 'text-gray-800';

    if (p.includes('paystack')) {
      bgColor = 'bg-blue-50';
      textColor = 'text-blue-700';
    } else if (p.includes('credpal') || p.includes('credit')) {
      bgColor = 'bg-purple-50';
      textColor = 'text-purple-700';
    } else if (p.includes('kora')) {
      bgColor = 'bg-green-50';
      textColor = 'text-green-700';
    }

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-md text-sm font-medium ${bgColor} ${textColor}`}>
        {provider}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center pt-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
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
            href={getUrl('/account/orders') as any}
            className="p-2 hover:bg-white rounded-full transition-colors text-gray-500 hover:text-gray-900 border border-transparent hover:border-gray-200"
          >
            <ChevronLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Order Details</h1>
            <p className="text-xs text-gray-500">
              #{order.order_number || order.id?.slice(0, 8)} • {new Date(order.created_at || Date.now()).toLocaleDateString()}
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
                  {getStatusIcon(order.shipping_status || 'Pending')} {order.shipping_status || 'Pending'}
                </span>
              </div>
              {/* Progress Bar (Visual only for now - Mapping status) */}
              <div className="relative pt-4 pb-2">
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${(order.shipping_status === 'Delivered') ? 'bg-green-500 w-full' :
                      (order.shipping_status === 'Shipped') ? 'bg-blue-500 w-2/3' :
                        (order.shipping_status === 'Processing') ? 'bg-amber-500 w-1/3' : 'bg-gray-300 w-1/12'
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

            {/* Items List */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                <h2 className="font-bold text-gray-900 text-sm">
                  Items ({order.items?.length || 0})
                </h2>
              </div>
              <div className="p-4 space-y-4">
                {order.items?.map((item) => (
                  (() => {
                    const productHref = getStorefrontOrderItemHref(
                      item,
                      storeSlug ? `/${storeSlug}` : ''
                    );

                    if (!productHref) {
                      return (
                        <div
                          key={item.id}
                          className="flex gap-4 items-start pb-4 border-b border-gray-50 last:border-0 last:pb-0"
                        >
                          <div className="w-20 h-20 bg-gray-50 rounded-xl p-2 border border-gray-100 flex-shrink-0 block">
                            <img
                              src={item.product_image || item.image || item.product_images?.[0] || '/placeholder.png'}
                              alt={item.product_name || item.name}
                              className="w-full h-full object-contain mix-blend-multiply"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-gray-900 text-sm mb-1">
                              {item.product_name || item.name}
                            </h3>
                            <p className="text-xs text-gray-500 mb-2">
                              Qty: {item.quantity}
                            </p>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-bold text-gray-900">
                                {new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(item.price || 0)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={item.id}
                        className="flex gap-4 items-start pb-4 border-b border-gray-50 last:border-0 last:pb-0"
                      >
                        <Link
                          href={productHref}
                          className="w-20 h-20 bg-gray-50 rounded-xl p-2 border border-gray-100 flex-shrink-0 block"
                        >
                          <img
                            src={item.product_image || item.image || item.product_images?.[0] || '/placeholder.png'}
                            alt={item.product_name || item.name}
                            className="w-full h-full object-contain mix-blend-multiply"
                          />
                        </Link>
                        <div className="flex-1 min-w-0">
                          <Link href={productHref}>
                            <h3 className="font-bold text-gray-900 text-sm mb-1 hover:text-red-600 transition-colors">
                              {item.product_name || item.name}
                            </h3>
                          </Link>
                          <p className="text-xs text-gray-500 mb-2">
                            Qty: {item.quantity}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-gray-900">
                              {new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(item.price || 0)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Order Summary */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <h3 className="font-bold text-gray-900 text-sm mb-4">
                Order Summary
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span>
                  <span>{new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(order.subtotal || order.total || 0)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Delivery</span>
                  <span>{(order.shipping_cost ?? order.shipping_fee) ? new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(order.shipping_cost ?? order.shipping_fee ?? 0) : <span className="text-green-600">Free</span>}</span>
                </div>
                <div className="border-t border-dashed border-gray-200 pt-3 flex justify-between font-bold text-lg text-gray-900">
                  <span>Total</span>
                  <span>{new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(order.total || 0)}</span>
                </div>
              </div>
            </div>

            {/* Delivery & Payment Info */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-6">
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <MapPin size={14} /> Delivery Details
                </h4>
                <p className="text-sm font-bold text-gray-900">
                  {order.shipping_provider || 'Standard Delivery'}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {typeof order.shipping_address === 'string'
                    ? order.shipping_address
                    : (order.shipping_address && typeof order.shipping_address === 'object')
                      ? `${order.shipping_address.address_line1 || ''}, ${order.shipping_address.city || ''}`
                      : 'No address provided'}
                </p>
              </div>
              <div className="border-t border-gray-50 pt-4">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <CreditCard size={14} /> Payment Method
                </h4>
                <div className="mt-2 text-sm font-bold text-gray-900">
                  <PaymentDisplay provider={order.payment_method || order.payment_provider || order.paymentMethod} />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                type="button"
                className="w-full bg-white border border-gray-200 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <Download size={18} /> Download Invoice
              </button>
              <button
                type="button"
                onClick={handleBuyAgain}
                className="w-full bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 transition-colors flex items-center justify-center gap-2 shadow-lg active:scale-95"
              >
                <ShoppingBag size={18} /> Shop Products
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
