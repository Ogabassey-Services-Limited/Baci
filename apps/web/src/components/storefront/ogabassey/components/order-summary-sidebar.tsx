import {
  CreditCard,
  Download,
  MapPin,
  ShoppingBag,
} from 'lucide-react';
import { PaymentDisplay } from './payment-display';
import { formatAddress } from '@/lib/format-address';
import type { StorefrontOrder } from '@/types/storefront-order';

interface OrderSummarySidebarProps {
  order: StorefrontOrder;
  onBuyAgain: () => void;
}

/**
 * Sidebar showing order summary, delivery/payment info, and action buttons.
 */
export function OrderSummarySidebar({ order, onBuyAgain }: OrderSummarySidebarProps) {
  return (
    <div className="lg:col-span-1 space-y-6">
      {/* Order Summary */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <h3 className="font-bold text-gray-900 text-sm mb-4">Order Summary</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between text-gray-500">
            <span>Subtotal</span>
            <span>
              {new Intl.NumberFormat('en-NG', {
                style: 'currency',
                currency: 'NGN',
              }).format(order.subtotal || order.total || 0)}
            </span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Delivery</span>
            <span>
              {order.shipping_cost ? (
                new Intl.NumberFormat('en-NG', {
                  style: 'currency',
                  currency: 'NGN',
                }).format(order.shipping_cost)
              ) : (
                <span className="text-green-600">Free</span>
              )}
            </span>
          </div>
          <div className="border-t border-dashed border-gray-200 pt-3 flex justify-between font-bold text-lg text-gray-900">
            <span>Total</span>
            <span>
              {new Intl.NumberFormat('en-NG', {
                style: 'currency',
                currency: 'NGN',
              }).format(order.total || 0)}
            </span>
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
            {formatAddress(order.shipping_address)}
          </p>
        </div>
        <div className="border-t border-gray-50 pt-4">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <CreditCard size={14} /> Payment Method
          </h4>
          <div className="mt-2 text-sm font-bold text-gray-900">
            <PaymentDisplay
              provider={order.payment_provider || order.payment_method || undefined}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="w-full bg-white border border-gray-200 text-gray-400 font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-sm opacity-50 cursor-not-allowed"
        >
          <Download size={18} /> Download Invoice
        </button>
        <button
          type="button"
          onClick={onBuyAgain}
          className="w-full text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg active:scale-95"
          style={{ backgroundColor: 'var(--store-primary, #dc2626)' }}
        >
          <ShoppingBag size={18} /> Buy Again
        </button>
      </div>
    </div>
  );
}
