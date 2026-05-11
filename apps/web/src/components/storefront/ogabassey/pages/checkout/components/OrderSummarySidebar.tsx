'use client';

import { ThumbnailImage } from '@/components/optimized-image';
import { ChevronRight, Loader2, ShieldCheck } from 'lucide-react';
import type { PaymentMethod, ResumedOrder } from '../types';

interface OrderItem {
  cartItemId?: string;
  id?: string | number;
  image?: string;
  image_url?: string;
  name?: string;
  product_name?: string;
  quantity: number;
  price: number;
  negotiatedPrice?: number;
}

interface OrderSummarySidebarProps {
  items: OrderItem[];
  resumedOrder: ResumedOrder | null;
  cartTotal: number;
  deliveryCost: number;
  remainingAmount: number;
  walletAmountUsed: number;
  orderTotals: { total: number; taxAmount: number } | null;
  taxRate: number;
  deliveryMethod: 'pickup' | 'door' | 'airport';
  selectedQuoteId: string;
  giftWrappingCost: number;
  walletLoading: boolean;
  walletBalance: number;
  payWithWallet: boolean;
  setPayWithWallet: (v: boolean) => void;
  user: { id: string } | null | undefined;
  newsletterOptIn: boolean;
  setNewsletterOptIn: (v: boolean) => void;
  paymentMethod: PaymentMethod;
  isProcessing: boolean;
  isPayForMeValid: boolean;
  handlePlaceOrder: () => void;
}

export function OrderSummarySidebar({
  items,
  resumedOrder,
  cartTotal,
  deliveryCost,
  remainingAmount,
  walletAmountUsed,
  orderTotals,
  taxRate,
  deliveryMethod,
  selectedQuoteId,
  giftWrappingCost,
  walletLoading,
  walletBalance,
  payWithWallet,
  setPayWithWallet,
  user,
  newsletterOptIn,
  setNewsletterOptIn,
  paymentMethod,
  isProcessing,
  isPayForMeValid,
  handlePlaceOrder,
}: OrderSummarySidebarProps) {
  const displayItems =
    items.length > 0 ? items : (resumedOrder?.items || []);

  return (
    <div className="hidden lg:block lg:col-span-4 lg:sticky lg:top-24 space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          Order Summary
        </h2>

        {/* Items List */}
        <div className="space-y-4 mb-6 max-h-[200px] overflow-y-auto pr-1">
          {displayItems.map((item: OrderItem, index) => (
            <div
              key={item.cartItemId ?? item.id ?? `order-item-${index}`}
              className="flex gap-3"
            >
              <div className="w-12 h-12 bg-gray-50 rounded-lg border border-gray-100 p-1 shrink-0 relative">
                <ThumbnailImage
                  src={item.image || item.image_url || '/placeholder.png'}
                  alt={
                    item.name || item.product_name || 'Product thumbnail'
                  }
                  width={40}
                  height={40}
                  className="w-full h-full object-contain mix-blend-multiply"
                  fallbackSrc="/placeholder.png"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 line-clamp-1">
                  {item.name || item.product_name}
                </p>
                <div className="flex justify-between items-center text-xs text-gray-500 mt-0.5">
                  <span>Qty: {item.quantity}</span>
                  <span>
                    ₦
                    {(
                      item.negotiatedPrice || item.price
                    ).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-dashed border-gray-200 my-4" />

        <div className="space-y-3 mb-6">
          <div className="flex justify-between text-gray-600 text-sm">
            <span>Subtotal</span>
            <span>₦{cartTotal.toLocaleString()}</span>
          </div>
          {orderTotals && taxRate > 0 && (
            <div className="flex justify-between text-gray-600 text-sm">
              <span>VAT ({(taxRate * 100).toFixed(1)}%)</span>
              <span>
                ₦{orderTotals.taxAmount.toLocaleString()}
              </span>
            </div>
          )}
          <div className="flex justify-between text-gray-600 text-sm">
            <span>Delivery</span>
            <span
              className={
                deliveryCost === 0
                  ? 'text-green-600 font-bold'
                  : 'text-gray-900'
              }
            >
              {deliveryMethod === 'door' &&
              !selectedQuoteId &&
              deliveryCost === 0 ? (
                <span className="text-gray-500 font-normal italic">
                  Calculated...
                </span>
              ) : deliveryCost === 0 ? (
                'Free'
              ) : (
                `₦${deliveryCost.toLocaleString()}`
              )}
            </span>
          </div>
          {giftWrappingCost > 0 && (
            <div className="flex justify-between text-gray-600 text-sm">
              <span>Gift Wrapping</span>
              <span>₦{giftWrappingCost.toLocaleString()}</span>
            </div>
          )}

          {/* Wallet Credit Section */}
          {(walletLoading || walletBalance > 0) && user && (
            <div className="py-2 animate-in fade-in">
              {walletLoading ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">
                    Checking wallet balance...
                  </span>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                        <span className="text-green-600 text-xs font-bold">
                          ₦
                        </span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-700">
                          Wallet Credit
                        </span>
                        <span className="text-xs text-gray-500 ml-1">
                          (₦{walletBalance.toLocaleString()}{' '}
                          available)
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setPayWithWallet(!payWithWallet)
                      }
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                        payWithWallet
                          ? 'bg-green-600'
                          : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          payWithWallet
                            ? 'translate-x-4'
                            : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                  {payWithWallet && walletAmountUsed > 0 && (
                    <div className="flex justify-between text-green-700 text-sm font-medium mt-2 pl-8">
                      <span>Applied Credit</span>
                      <span>
                        -₦{walletAmountUsed.toLocaleString()}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="border-t border-dashed border-gray-200 my-2" />

          <div className="flex justify-between text-gray-900 font-bold text-lg">
            <span>
              {remainingAmount > 0 && payWithWallet
                ? 'Amount Due'
                : 'Total'}
            </span>
            <span>₦{remainingAmount.toLocaleString()}</span>
          </div>
        </div>

        {/* Newsletter Opt-in */}
        {!user && (
          <label className="flex items-start gap-3 cursor-pointer group mb-4 px-1">
            <div className="relative flex items-center pt-0.5">
              <input
                id="newsletter-summary-opt-in"
                type="checkbox"
                checked={newsletterOptIn}
                onChange={(e) =>
                  setNewsletterOptIn(e.target.checked)
                }
                className="peer h-4 w-4 rounded border-gray-300 text-(--store-primary) focus:ring-(--store-primary)"
              />
            </div>
            <span className="text-xs text-gray-600 group-hover:text-gray-900 transition-colors">
              Email me with exclusive offers and new product drops.
            </span>
          </label>
        )}

        <button
          onClick={handlePlaceOrder}
          disabled={
            isProcessing ||
            (remainingAmount > 0 && !paymentMethod) ||
            (paymentMethod === 'payforme' && !isPayForMeValid)
          }
          className="hidden lg:flex w-full bg-(--store-primary) hover:bg-(--store-primary)/90 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold py-3.5 px-4 rounded-xl items-center justify-center gap-2 transition-all shadow-lg hover:shadow-(--store-primary)/20 active:scale-[0.98]"
        >
          {isProcessing ? (
            <Loader2 className="animate-spin" />
          ) : paymentMethod === 'invoice' ? (
            'Generate Invoice'
          ) : paymentMethod === 'payforme' ? (
            'Send Payment Link'
          ) : (
            'Place Order'
          )}
          {!isProcessing && <ChevronRight size={20} />}
        </button>

        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-green-600 font-medium">
          <ShieldCheck size={14} /> Secure Encrypted Payment
        </div>
      </div>
    </div>
  );
}
