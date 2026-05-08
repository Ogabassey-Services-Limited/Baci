'use client';

import {
  ArrowRight,
  Calculator,
  Check,
  HandCoins,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type React from 'react';
import { useState, useEffect } from 'react';
import { type CartItem, useCart } from '@/hooks/cart';
import { useMerchantSafe } from '@/hooks/use-merchant';
import { analytics } from '@/lib/analytics';
import { asRoute } from '@/lib/routes';
import { getStorefrontProductHref } from '@/lib/storefront-product-href';
import { AdUnit } from './AdUnit';
// import { ActionTooltip } from './Tooltip';
import { EmptyState } from './empty-state';
import Image from 'next/image';
import { NegotiationModal } from './NegotiationModal';

// Helper type to manage modal state more cleanly
interface NegotiationState {
  isOpen: boolean;
  type: 'single' | 'total';
  item?: CartItem; // Present if type is 'single'
  currentPrice: number;
  name: string;
}

export const CartSidebar: React.FC = () => {
  const {
    isCartOpen,
    setIsCartOpen,
    cart,
    removeFromCart,
    updateQuantity,
    applyNegotiatedPrice,
    applyCartWideNegotiation,
    toggleAssurance,
    cartTotal,
  } = useCart();

  const [negotiationState, setNegotiationState] =
    useState<NegotiationState | null>(null);

  // Get merchant context for slug
  const merchantContext = useMerchantSafe();
  const merchant = merchantContext?.merchant;
  const basePath = merchantContext?.basePath;

  const getHref = (path: string) =>
    path.startsWith('http') ? path : `${basePath || ''}${path === '/' ? '' : path}`;

  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const router = useRouter();

  /* eslint-enable @typescript-eslint/no-unused-vars */

  // Track ViewCart event when sidebar opens
  useEffect(() => {
    if (isCartOpen && cart.length > 0) {
      // Map cart items to Product structure expected by analytics
      const analyticsProducts = cart.map((item) => ({
        product: {
          id: item.id,
          name: item.name,
          price: item.price,
          category: item.category,
          brand: item.brand,
        } as any, // Cast to avoid full Product type mismatch if needed
        quantity: item.quantity,
      }));

      analytics.viewCart(analyticsProducts, 'NGN', {
        merchantId: merchant?.id || '',
        // If we had user data context, we would pass it here
        // userData: { email: user?.email, ... }
      });
    }
  }, [isCartOpen, cart, merchant?.id]);

  if (!isCartOpen) return null;

  const handleNegotiationSuccess = (finalPrice: number) => {
    if (!negotiationState) return;

    if (negotiationState.type === 'single' && negotiationState.item) {
      // finalPrice is the negotiated TOTAL for the line item (Unit Price * Quantity)
      const quantity = negotiationState.item.quantity;
      const newUnitPrice = finalPrice / quantity;
      applyNegotiatedPrice?.(negotiationState.item.cartItemId, newUnitPrice);
    } else if (negotiationState.type === 'total') {
      applyCartWideNegotiation?.(finalPrice);
    }
  };

  const openItemNegotiation = (item: CartItem) => {
    const currentUnitPrice = item.negotiatedPrice || item.price || 0;
    const currentTotal = currentUnitPrice * item.quantity;

    setNegotiationState({
      isOpen: true,
      type: 'single',
      item: item,
      currentPrice: currentTotal,
      name: item.quantity > 1 ? `${item.name} (x${item.quantity})` : item.name,
    });
  };

  const openTotalNegotiation = () => {
    setNegotiationState({
      isOpen: true,
      type: 'total',
      currentPrice: cartTotal,
      name: 'Entire Cart',
    });
  };

  return (
    <>
      {/* High Z-Index to cover Mobile Footer (z-40) */}
      <div className="fixed inset-0 z-60 overflow-hidden">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
          onClick={() => setIsCartOpen(false)}
        />

        {/* Sidebar Panel - SWIPES FROM RIGHT */}
        <div className="absolute inset-y-0 right-0 max-w-full flex">
          <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <ShoppingBag className="text-red-600" />
                Your Cart
                <span className="text-sm font-medium text-gray-500 ml-2">
                  ({cart.length} items)
                </span>
              </h2>
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500 hover:text-red-600"
                aria-label="Close cart"
              >
                <X size={24} />
              </button>
            </div>

            {/* Cart Items List */}
            <div
              className={`flex-1 overflow-y-auto p-6 ${cart.length === 0 ? 'flex flex-col' : 'space-y-6'}`}
            >
              {cart.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <EmptyState
                    variant="cart"
                    title="Your cart is empty 🤧"
                    description="Sorry, the product you are looking for is currently not available at the moment."
                    actionLabel="Start Shopping"
                    onAction={() => setIsCartOpen(false)}
                  />
                </div>
              ) : (
                <>
                  {cart.map((item) => {
                    const productHref = asRoute(
                      getStorefrontProductHref(item, basePath || '')
                    );
                    const priceToUse =
                      item.negotiatedPrice !== undefined
                        ? item.negotiatedPrice
                        : item.price;
                    const itemTotal = priceToUse * item.quantity;
                    const assuranceCost = itemTotal * 0.05;

                    return (
                      <div
                        key={item.cartItemId}
                        className="flex gap-4 animate-in fade-in duration-300 border-b border-gray-50 pb-6 last:border-0 last:pb-0"
                      >
                        <Link
                          href={productHref}
                          className="relative w-24 h-24 bg-gray-50 rounded-lg border border-gray-100 p-2 shrink-0 self-start mt-1 block group/image"
                        >
                          <Image
                            src={item.image || '/placeholder.png'}
                            alt={item.name}
                            fill
                            sizes="96px"
                            className="object-contain mix-blend-multiply p-1"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = '/placeholder.png';
                            }}
                          />
                          {/* Condition Badge - Bottom Center Overlay */}
                          {item.condition && (
                            <span
                              className={`absolute -bottom-2 left-1/2 -translate-x-1/2 text-[9px] font-bold px-2 py-0.5 rounded-full border shadow-sm uppercase tracking-wider whitespace-nowrap z-10 ${item.condition?.toLowerCase() === 'new'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : 'bg-amber-100 text-amber-800 border-amber-200'
                                }`}
                            >
                              {item.condition}
                            </span>
                          )}
                        </Link>
                        <div className="flex-1 flex flex-col justify-between min-h-[100px]">
                          <div>
                            <div className="flex justify-between items-start">
                              <Link
                                href={productHref}
                                className="font-bold text-gray-900 line-clamp-1 text-sm hover:text-red-600 transition-colors"
                              >
                                {item.name}
                              </Link>
                              <button
                                onClick={() => removeFromCart(item.cartItemId)}
                                className="text-gray-400 hover:text-red-600 p-1 -mt-1 -mr-1"
                                aria-label="Remove item"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>

                            {/* Item Details: Color & Storage */}
                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                              {/* Removed Condition from here, moved to image overlay */}

                              {/* Color & Storage */}
                              <div className="text-xs text-gray-500 flex items-center gap-1">
                                {item.selectedColor && (
                                  <span className="flex items-center gap-1">
                                    <span
                                      className="w-2.5 h-2.5 rounded-full border border-gray-300 shadow-sm"
                                      style={{
                                        backgroundColor:
                                          item.selectedColorValue ||
                                          item.selectedColor,
                                      }}
                                    />
                                    {item.selectedColor}
                                  </span>
                                )}
                                {item.secondaryColor && (
                                  <span className="text-[10px] text-blue-500">
                                    (Pref 2: {item.secondaryColor})
                                  </span>
                                )}
                                {item.selectedStorage && (
                                  <>
                                    <span>•</span>
                                    <span>{item.selectedStorage}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* BOTTOM ROW: Quantity/Negotiate (Left) | Price (Right) */}
                          <div className="flex items-end justify-between mt-3">
                            <div className="flex flex-col gap-3">
                              {/* Quantity */}
                              <div className="flex items-center border border-gray-200 rounded-md w-fit">
                                <button
                                  onClick={() =>
                                    updateQuantity(
                                      item.cartItemId,
                                      item.quantity - 1
                                    )
                                  }
                                  className="p-1 px-2 hover:bg-gray-50 text-gray-500"
                                  disabled={item.quantity <= 1}
                                  aria-label="Decrease quantity"
                                >
                                  <Minus size={12} />
                                </button>
                                <span className="w-6 text-center text-xs font-medium">
                                  {item.quantity}
                                </span>
                                <button
                                  onClick={() =>
                                    updateQuantity(
                                      item.cartItemId,
                                      item.quantity + 1
                                    )
                                  }
                                  className="p-1 px-2 hover:bg-gray-50 text-gray-500"
                                  aria-label="Increase quantity"
                                >
                                  <Plus size={12} />
                                </button>
                              </div>

                              {/* Negotiation - Bottom Left */}
                              {item.negotiationStatus === 'accepted' ? (
                                <div className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-md w-fit border border-green-100">
                                  <Check size={10} strokeWidth={3} />
                                  <span>
                                    Matched @ ₦
                                    {item.negotiatedPrice?.toLocaleString()}
                                  </span>
                                </div>
                              ) : (
                                <button
                                  onClick={() => openItemNegotiation(item)}
                                  className="flex items-center gap-1.5 text-[10px] font-bold text-red-600 hover:text-red-700 transition-colors"
                                >
                                  <HandCoins size={14} />
                                  <span>Negotiate</span>
                                </button>
                              )}
                            </div>

                            <div className="text-right pb-0.5">
                              {item.negotiatedPrice ? (
                                <div className="flex flex-col items-end">
                                  <span className="text-[10px] text-gray-400 line-through decoration-red-400">
                                    ₦
                                    {(
                                      item.price * item.quantity
                                    ).toLocaleString()}
                                  </span>
                                  <span className="font-bold text-green-600 text-sm">
                                    ₦{itemTotal.toLocaleString()}
                                  </span>
                                </div>
                              ) : (
                                <div className="font-bold text-gray-900 text-sm">
                                  ₦{itemTotal.toLocaleString()}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Assurance/Insurance Toggle */}
                          {merchant?.feature_settings?.shipping_insurance_enabled && (
                            <div className="mt-4 pt-3 border-t border-gray-50">
                              <label className="flex items-start gap-2 cursor-pointer group">
                                <div className="relative flex items-center mt-0.5">
                                  <input
                                    type="checkbox"
                                    checked={item.hasAssurance || false}
                                    onChange={() =>
                                      toggleAssurance?.(item.cartItemId)
                                    }
                                    className="peer sr-only"
                                  />
                                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                                      <ShieldCheck
                                        size={12}
                                        className="text-red-600"
                                      />
                                      {merchant?.slug === 'ogabassey' ? 'Ogabassey Assurance' : 'Order Protection'}
                                    </span>
                                    {item.hasAssurance && (
                                      <span className="text-xs font-bold text-gray-900">
                                        +₦{assuranceCost.toLocaleString()}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-gray-500 leading-tight mt-0.5">
                                    {item.hasAssurance ? (
                                      <>
                                        {merchant?.slug === 'ogabassey' ? (
                                          <>
                                            Covers <span className="font-bold text-gray-700">Screen & Liquid Damage</span>
                                          </>
                                        ) : (
                                          'Standard Shipping Protection'
                                        )}
                                      </>
                                    ) : (
                                      `${merchant?.slug === 'ogabassey' ? 'Device Protection' : 'Safety & Shipping Coverage'} (+5%)`
                                    )}
                                  </p>
                                </div>
                              </label>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Dynamic Ad Placement in Cart */}
                  <div className="mt-8 border-t border-gray-100 pt-4">
                    <AdUnit placementKey="CART_MPU" />
                  </div>
                </>
              )}
            </div>

            {/* Footer / Checkout */}
            {cart.length > 0 && (
              <div className="border-t border-gray-100 bg-gray-50 p-6 space-y-4 shrink-0">
                <div className="space-y-2">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span>₦{cartTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Shipping</span>
                    <span className="text-green-600">
                      Calculated at checkout
                    </span>
                  </div>
                  <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t border-gray-200">
                    <span>Total</span>
                    <span>₦{cartTotal.toLocaleString()}</span>
                  </div>
                </div>

                {/* Negotiate Total Button */}
                <button
                  onClick={openTotalNegotiation}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors border border-gray-200"
                >
                  <Calculator size={18} className="text-red-600" />
                  Negotiate Total Amount
                </button>

                <button
                  onClick={async () => {
                    setIsCheckoutLoading(true);
                    // Close the sidebar first to prevent it staying open
                    setIsCartOpen(false);
                    // Navigate to checkout
                    router.push(asRoute(getHref('/checkout')));
                    // Reset loading state after a delay (in case user comes back)
                    setTimeout(() => {
                      setIsCheckoutLoading(false);
                    }, 2000);
                  }}
                  disabled={isCheckoutLoading}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-red-200 group disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isCheckoutLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Proceed to Checkout
                      <ArrowRight
                        size={20}
                        className="group-hover:translate-x-1 transition-transform"
                      />
                    </>
                  )}
                </button>

                <div className="grid grid-cols-2 gap-3">
                  <Link
                    href={asRoute(getHref('/cart'))}
                    onClick={() => setIsCartOpen(false)}
                    className="w-full bg-white hover:bg-gray-50 text-gray-900 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors border border-gray-200 active:bg-gray-50 text-sm"
                  >
                    View Full Cart
                  </Link>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="w-full text-center text-gray-500 hover:text-gray-900 text-sm font-medium py-3.5 px-4 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Continue Shopping
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Negotiation Modal — only render when merchant context is available */}
      {negotiationState && merchant?.id && (
        <NegotiationModal
          isOpen={negotiationState.isOpen}
          onClose={() => setNegotiationState(null)}
          productName={negotiationState.name}
          currentPrice={negotiationState.currentPrice}
          onSuccess={handleNegotiationSuccess}
          type={negotiationState.type}
          merchantId={merchant.id}
        />
      )}
    </>
  );
};
