'use client';

import {
  Calendar,
  ExternalLink,
  History,
  ShieldCheck,
  ShoppingCart,
} from 'lucide-react';
import type React from 'react';
import { useCurrency } from '@/hooks/use-currency';
import { EmptyState } from '../components/empty-state';

// Interface matching the real order structure from the API
export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  image?: string; // Optional since API might not return it directly yet
  has_assurance?: boolean;
}

export interface Order {
  id: string;
  order_number: string;
  created_at: string;
  total: number;
  items: OrderItem[];
}

export interface PurchaseHistoryProps {
  orders: Order[];
  onBuyAgain?: (productName: string) => void; // Placeholder for now
  onViewDetails?: (orderId: string) => void;
}

export const OgabasseyV2PurchaseHistory: React.FC<PurchaseHistoryProps> = ({
  orders,
  onBuyAgain,
  onViewDetails,
}) => {
  const { formatCurrency } = useCurrency();

  // Helper to format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-12 pt-4 md:pt-8 flex flex-col">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 w-full flex-1 flex flex-col">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <History className="text-red-600 fill-red-600" />
          Purchase History
        </h1>

        {orders.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              variant="history"
              title="No purchase history"
              description="You haven't bought anything yet. Your purchased items will appear here."
              actionLabel="Start Shopping"
              actionLink="/"
            />
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="space-y-4">
                {/* Render each item in the order separately for the history view, or group them. 
                     The design suggests a list of items. 
                     We'll iterate items within the order. */}
                {order.items.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="bg-white rounded-2xl border border-gray-100 p-4 md:p-6 flex flex-col md:flex-row gap-6 items-start md:items-center shadow-sm hover:shadow-md transition-shadow"
                  >
                    {/* Image - Placeholder for now if not in API */}
                    <div className="size-20 bg-gray-50 rounded-xl p-2 shrink-0 border border-gray-100 flex items-center justify-center">
                      {/* TODO: Add image to Order Item API response */}
                      <ShoppingCart className="text-gray-300" size={32} />
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                        <Calendar size={12} />
                        <span>Purchased on {formatDate(order.created_at)}</span>
                      </div>
                      <h3 className="font-bold text-gray-900 text-sm md:text-base mb-1 truncate">
                        {item.name}
                      </h3>
                      <p className="text-sm font-bold text-red-600">
                        {formatCurrency(item.price)} <span className="text-gray-400 font-normal">x {item.quantity}</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-1">Order #{order.order_number}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 w-full md:w-auto mt-2 md:mt-0">
                      <button
                        type="button"
                        onClick={() => onBuyAgain?.(item.name)}
                        className="flex-1 md:flex-none bg-gray-900 text-white text-xs font-bold py-2.5 px-4 rounded-xl hover:bg-red-600 transition-colors flex items-center justify-center gap-2 shadow-sm active:scale-95"
                      >
                        <ShoppingCart size={14} /> Buy Again
                      </button>


                      <button
                        type="button"
                        onClick={() => onViewDetails?.(order.id)}
                        className="p-2.5 border border-gray-200 rounded-xl text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors"
                        title="View Order Details"
                      >
                        <ExternalLink size={16} />
                      </button>
                      {/* Assurance / Insurance Policy Link */}
                      {item.has_assurance && (
                        <a
                          href={`/account/orders/${order.id}/insurance`}
                          className="p-2.5 border border-green-200 bg-green-50 rounded-xl text-green-700 hover:bg-green-100 transition-colors flex items-center justify-center"
                          title="View Insurance Policy"
                        >
                          <ShieldCheck size={16} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div >
  );
};
