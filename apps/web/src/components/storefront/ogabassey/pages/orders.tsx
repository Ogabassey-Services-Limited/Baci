'use client';

import {
  CheckCircle2,
  ChevronRight,
  Clock,
  Package,
  Search,
  Truck,
  X,
  XCircle,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type React from 'react';
import { useState, useEffect } from 'react';
import { useMerchantSafe } from '@/hooks/use-merchant';
import { asRoute } from '@/lib/routes';
import { getStorefrontOrderItemHref } from '@/lib/storefront-order-item-href';
import { useCustomerAuth } from '@/contexts/customer-auth-context';

// Mock data removed
interface _OrderItem {
  id: string;
  name: string;
  description: string;
  image: string;
}

interface _Order {
  id: string;
  date: string;
  status: 'Processing' | 'Delivered' | 'Cancelled' | 'Shipped';
  total: string;
  items: _OrderItem[];
}

export const OgabasseyV2Orders: React.FC = () => {
  const merchantContext = useMerchantSafe();
  const { customer: _customer, isAuthenticated } = useCustomerAuth(); // Hook into auth
  const basePath = merchantContext?.merchant?.slug ? `/${merchantContext.merchant.slug}` : '';

  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch Orders
  useEffect(() => {
    const fetchOrders = async () => {
      if (!isAuthenticated || !merchantContext?.merchant?.slug) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/storefront/orders?merchantSlug=${merchantContext.merchant.slug}`);
        if (!res.ok) {
          throw new Error(`Failed to fetch orders: ${res.status}`);
        }

        const data = await res.json();
        if (data.orders) {
          // Transform if necessary or use directly
          setOrders(data.orders);
        }
      } catch (err) {
        console.error('Failed to fetch orders', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrders();
  }, [isAuthenticated, merchantContext?.merchant?.slug]);

  // Filter Logic
  const filteredOrders = orders.filter((order) => {
    const query = searchQuery.toLowerCase();
    // Safely check properties
    const orderIdMatch = order.order_number?.toLowerCase().includes(query) || order.id?.toLowerCase().includes(query);
    const statusMatch = order.shipping_status?.toLowerCase().includes(query) || order.payment_status?.toLowerCase().includes(query);
    const itemMatch = order.items?.some((item: any) => item.name.toLowerCase().includes(query));

    return orderIdMatch || statusMatch || itemMatch;
  });

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
    if (s === 'processing' || s === 'pending') return <Clock size={14} />;
    if (s === 'delivered') return <CheckCircle2 size={14} />;
    if (s === 'cancelled') return <XCircle size={14} />;
    if (s === 'shipped') return <Truck size={14} />;
    return <Package size={14} />;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        {/* Assuming Loader2 is available or use simple text */}
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-12 pt-4 md:pt-8 flex flex-col">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 w-full flex-1 flex flex-col">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="text-red-600 fill-red-600" />
            My Orders
          </h1>

          <div className="relative w-full md:w-96">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Order ID, Item or Status..."
              className="w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-200 transition-all text-sm"
            />
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="text-gray-400" size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                No orders yet
              </h3>
              <p className="text-gray-500 text-sm mb-4">
                Looks like you haven&apos;t placed any orders yet.
              </p>
              <Link
                href={asRoute(basePath)}
                className="inline-block bg-red-600 text-white font-bold py-2.5 px-6 rounded-xl text-sm hover:bg-red-700 transition-colors"
              >
                Start Shopping
              </Link>
            </div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-200">
                <Search className="text-gray-400" size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                No orders found
              </h3>
              <p className="text-gray-500 text-sm">
                We couldn&apos;t find any orders matching &quot;{searchQuery}
                &quot;
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="mt-4 text-red-600 font-bold text-sm hover:underline"
              >
                Clear Search
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 group active:scale-[0.99]"
              >
                {/* Order Header */}
                <div className="p-4 md:p-6 border-b border-gray-50 flex flex-wrap gap-4 justify-between items-center bg-gray-50/30">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-bold text-gray-900 text-sm">
                        {order.order_number || order.id?.slice(0, 8)}
                      </h3>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 uppercase tracking-wide ${getStatusColor(order.shipping_status || 'Pending')}`}
                      >
                        {getStatusIcon(order.shipping_status || 'Pending')} {order.shipping_status || 'Pending'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {new Date(order.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 mb-0.5">Total Amount</p>
                    <p className="font-bold text-gray-900">
                      {new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(order.total || 0)}
                    </p>
                  </div>
                </div>

                {/* Order Items */}
                <div className="p-4 md:p-6">
                  <div className="flex flex-col gap-4">
                    {order.items?.map((item: any) => (
                      (() => {
                        const productHref = getStorefrontOrderItemHref(
                          item,
                          basePath
                        );

                        if (!productHref) {
                          return (
                            <div
                              key={item.id}
                              className="flex gap-4 items-center group/item hover:bg-gray-50 p-2 rounded-xl transition-colors -mx-2"
                            >
                              <div className="w-16 h-16 bg-gray-50 rounded-lg p-2 border border-gray-100 flex-shrink-0 group-hover/item:bg-white group-hover/item:border-red-100 transition-colors relative">
                                <Image
                                  src={item.image || item.product_image || '/placeholder.png'}
                                  alt={item.name}
                                  fill sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                  className="object-contain mix-blend-multiply p-1"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-sm text-gray-900 line-clamp-1">
                                  {item.name}
                                </h4>
                                <p className="text-xs text-gray-500 line-clamp-1">
                                  Qty: {item.quantity}
                                </p>
                              </div>
                              {order.items.length === 1 && (
                                <span className="text-xs font-bold text-red-600 whitespace-nowrap hidden sm:block bg-red-50 px-3 py-1.5 rounded-lg">
                                  Buy Again
                                </span>
                              )}
                            </div>
                          );
                        }

                        return (
                          <Link
                            key={item.id}
                            href={asRoute(productHref)}
                            className="flex gap-4 items-center group/item hover:bg-gray-50 p-2 rounded-xl transition-colors -mx-2"
                          >
                            <div className="w-16 h-16 bg-gray-50 rounded-lg p-2 border border-gray-100 flex-shrink-0 group-hover/item:bg-white group-hover/item:border-red-100 transition-colors relative">
                              <Image
                                src={item.image || item.product_image || '/placeholder.png'}
                                alt={item.name}
                                fill sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                className="object-contain mix-blend-multiply p-1"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-sm text-gray-900 line-clamp-1 group-hover/item:text-red-600 transition-colors">
                                {item.name}
                              </h4>
                              <p className="text-xs text-gray-500 line-clamp-1">
                                Qty: {item.quantity}
                              </p>
                            </div>
                            {order.items.length === 1 && (
                              <span className="text-xs font-bold text-red-600 whitespace-nowrap hidden sm:block bg-red-50 px-3 py-1.5 rounded-lg">
                                Buy Again
                              </span>
                            )}
                          </Link>
                        );
                      })()
                    ))}
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-50 flex justify-between items-center">
                    <span className="text-xs text-gray-400">
                      {order.items?.length || 0} item(s)
                    </span>
                    <Link
                      href={asRoute(`${basePath}/account/orders/${order.id}`)}
                      className="text-sm font-bold text-gray-900 flex items-center gap-1 hover:text-red-600 transition-colors"
                    >
                      View Details <ChevronRight size={16} />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
