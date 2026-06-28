'use client';
// Migrated from temp-source/components/CartPage.tsx
import {
  ArrowRight,
  Check,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Trash2,
} from 'lucide-react';

const AppNegotiateIcon = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
  <svg
    viewBox="0 0 512 512"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="38"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect x="32" y="80" width="448" height="256" rx="16" ry="16" />
    <path d="M64 384h384M96 432h320" />
    <circle cx="256" cy="208" r="80" />
    <path d="M480 160a80 80 0 01-80-80M32 160a80 80 0 0080-80M480 256a80 80 0 00-80 80M32 256a80 80 0 0180 80" />
  </svg>
);
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { useEffect, useState } from 'react';
import { type CartItem, useCart } from '@/hooks/cart';
import { useAuthSafe } from '@/contexts/auth-context';
import { useMerchantSafe } from '@/hooks/use-merchant-client';
import { DEFAULT_ASSURANCE_RATE } from '@/lib/checkout/constants';
import { getStorefrontProductHref } from '@/lib/storefront-product-href';
import { AdUnit } from '../components/AdUnit';
import { NegotiationModal } from '../components/NegotiationModal';
import { CheckoutIdentityModal } from '../components/CheckoutIdentityModal';
import { runCartTotalNegotiation } from '../lib/cart-total-negotiation';
import { CartEmptyState } from './cart-empty-state';
import { hasPriceNegotiationEntitlement } from '@/lib/feature-flags';
import { isProductNegotiable } from '@baci/shared/lib';
import {
  calculateCartTotal,
  getCartItemCheckoutUnitPrice,
  isQuizVoucherCartItem,
  sanitizeCartItems,
} from '@/lib/checkout/cart-entitlement-sanitizer';

interface NegotiationState {
  isOpen: boolean;
  type: 'single' | 'total';
  item?: CartItem;
  currentPrice: number;
  name: string;
}

interface CartPageProps {
  vatEnabled?: boolean;
  vatRate?: number;
}

export const CartPage: React.FC<CartPageProps> = ({ vatEnabled = false, vatRate = 7.5 }) => {
  const {
    cart,
    removeFromCart,
    updateQuantity,
    applyNegotiatedPrice,
    applyCartWideNegotiation,
    clearNegotiatedPrice,
    toggleAssurance,
    merchantSlug,
  } = useCart();

  const merchantContext = useMerchantSafe();
  const auth = useAuthSafe();
  const user = auth?.user;

  const merchant = merchantContext?.merchant;
  const settings = merchant?.feature_settings;
  const basePath = merchantContext?.basePath ?? `/${merchantSlug || 'ogabassey'}`;
  const negotiationVatRate =
    merchant?.vat_registration_status === 'registered'
      ? (merchant.vat_rate ?? vatRate) / 100
      : vatEnabled
        ? vatRate / 100
        : 0;

  const hasPriceNegotiation = hasPriceNegotiationEntitlement(merchant?.plan_tier, merchant?.slug);

  const displayCart = sanitizeCartItems(cart, hasPriceNegotiation);

  const displayCartTotal = calculateCartTotal(cart, hasPriceNegotiation);

  const hasNonNegotiableCartItem = displayCart.some(
    (item) =>
      !isQuizVoucherCartItem(item) &&
      !isProductNegotiable({ brand: item.brand, name: item.name })
  );

  const [negotiationState, setNegotiationState] =
    useState<NegotiationState | null>(null);
  const [isIdentityModalOpen, setIsIdentityModalOpen] = useState(false);
  const router = useRouter();

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleNegotiationSuccess = (finalPrice: number) => {
    if (!negotiationState) return;

    if (negotiationState.type === 'single' && negotiationState.item) {
      // finalPrice is the negotiated TOTAL for the line item (Unit Price * Quantity)
      // We need to convert it back to Unit Price for the system
      const quantity = negotiationState.item.quantity;
      const newUnitPrice = finalPrice / quantity;
      applyNegotiatedPrice?.(negotiationState.item.cartItemId, newUnitPrice);
    } else if (negotiationState.type === 'total') {
      applyCartWideNegotiation?.(finalPrice);
    }
  };

  // Helper function to actually open item negotiation
  const actuallyOpenItemNegotiation = (item: CartItem) => {
    const currentUnitPrice = item.negotiatedPrice || item.price || 0;
    const currentTotal = currentUnitPrice * item.quantity;

    setNegotiationState({
      isOpen: true,
      type: 'single',
      item: item,
      currentPrice: currentTotal,
      name: item.quantity > 1 ? `${item.name} (x${item.quantity})` : item.name,
    });
    setShowNegotiateWarning(false);
    setPendingNegotiateItem(null);
  };

  // State for negotiate mode warning
  const [showNegotiateWarning, setShowNegotiateWarning] = useState(false);
  const [pendingNegotiateItem, setPendingNegotiateItem] = useState<CartItem | null>(null);

  const openItemNegotiation = (item: CartItem) => {
    if (!isProductNegotiable({ brand: item.brand, name: item.name })) {
      return;
    }

    // Check if any item already has individual negotiation
    const hasAnyIndividualNegotiation = displayCart.some(i => i.negotiatedPrice != null);

    // Check if cart-wide discount is active (would need to check cartDiscount in items)
    const hasBulkDiscount = displayCart.some((item) => (item.cartDiscount ?? 0) > 0);

    if (hasBulkDiscount) {
      // Bulk mode is active, show error
      alert('You already have a bulk discount applied. Remove it before negotiating items individually.');
      return;
    }

    if (hasAnyIndividualNegotiation) {
      // Already using individual mode, proceed directly
      actuallyOpenItemNegotiation(item);
    } else {
      // First negotiation - show warning modal
      setPendingNegotiateItem(item);
      setShowNegotiateWarning(true);
    }
  };

  const openTotalNegotiation = () => {
    if (hasNonNegotiableCartItem) {
      return;
    }

    runCartTotalNegotiation({
      cart,
      fallbackTotal: displayCartTotal,
      clearNegotiatedPrice,
      confirmReset: () =>
        window.confirm(
          'Negotiating your whole cart will clear the prices you negotiated on individual items. Reset them and continue?'
        ),
      openBulk: (currentPrice) =>
        setNegotiationState({
          isOpen: true,
          type: 'total',
          currentPrice,
          name: 'Entire Cart',
        }),
    });
  };

  const handleCheckoutClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (user) {
      // Logged in user - proceed directly
      router.push(`${basePath}/checkout` as any);
    } else {
      // Guest user - show identity choice
      setIsIdentityModalOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-12 pt-4 md:pt-8 flex flex-col">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 w-full flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center mb-6 shrink-0">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingCart className="text-store-primary fill-red-600" />
            Cart{' '}
            <span className="text-gray-400 text-lg font-medium">
              ({displayCart.length})
            </span>
          </h1>
        </div>

        {displayCart.length === 0 ? (
          <div className="flex-1 flex items-start justify-center pb-20">
            <CartEmptyState basePath={basePath || '/'} />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            {/* Cart Items List */}
            <div className="lg:col-span-8 space-y-4">
              {displayCart.map((item, index) => {
                const productHref = getStorefrontProductHref(item, basePath);
                const isQuizGift = isQuizVoucherCartItem(item);
                const priceToUse = getCartItemCheckoutUnitPrice(item);
                const itemQuantity = (typeof item.quantity === 'number' && !isNaN(item.quantity)) ? item.quantity : 0;
                const itemTotal = priceToUse * itemQuantity;
                const assuranceRate =
                  item.assuranceRate ?? DEFAULT_ASSURANCE_RATE;
                const assuranceRateLabel = `${Number(
                  (assuranceRate * 100).toFixed(2)
                )}%`;
                const assuranceCost = item.hasAssurance
                  ? itemTotal * assuranceRate
                  : 0;

                return (
                  <div
                    key={item.cartItemId || `${item.id}-${index}`}
                    className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden transition-all md:hover:shadow-md active:scale-[0.99] md:active:scale-100 touch-manipulation"
                  >
                    {/* Top Row: Image & Basic Info */}
                    <div className="flex gap-4">
                      {/* Image */}
                      <Link
                        href={productHref}
                        className="w-20 h-20 md:w-28 md:h-28 bg-gray-50 rounded-xl border border-gray-100 p-2 shrink-0 flex items-center justify-center relative overflow-hidden"
                      >
                        <Image
                          src={item.image || '/placeholder.png'}
                          alt={item.name}
                          fill
                          sizes="(max-width: 768px) 80px, 112px"
                          className="object-contain mix-blend-multiply p-2"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = '/placeholder.png';
                          }}
                        />
                      </Link>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pr-8">
                        <Link href={productHref}>
                          <h3 className="font-bold text-gray-900 text-sm md:text-base line-clamp-2 leading-tight mb-2 hover:text-store-primary transition-colors">
                            {item.name}
                          </h3>
                        </Link>

                        {/* Tags */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${item.condition?.toLowerCase() === 'new'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              : 'bg-amber-50 text-amber-700 border-amber-100'
                              }`}
                          >
                            {item.condition}
                          </span>
                          {item.selectedColor && (
                            <div className="flex items-center gap-1 bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5">
                              <span
                                className="size-2 rounded-full border border-gray-300"
                                style={{
                                  backgroundColor:
                                    item.selectedColorValue ||
                                    item.selectedColor,
                                }}
                              />
                              <span className="text-[10px] text-gray-600">
                                {item.selectedColor}
                              </span>
                            </div>
                          )}
                          {item.secondaryColor && (
                            <div className="flex items-center gap-1 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5">
                              <span className="text-[9px] text-blue-600 font-bold">
                                Pref 2:
                              </span>
                              <span className="text-[10px] text-gray-600">
                                {item.secondaryColor}
                              </span>
                            </div>
                          )}
                          {item.selectedStorage && (
                            <div className="bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5 text-[10px] text-gray-600">
                              {item.selectedStorage}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Remove Button - Absolute Top Right */}
                      <button type="button"
                        onClick={() => removeFromCart(item.cartItemId)}
                        className="absolute top-4 right-4 text-store-primary md:hover:text-store-primary p-1.5 md:hover:bg-store-primary/5 rounded-full transition-colors active:bg-store-primary/5"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {/* Separator */}
                    <div className="my-3 border-t border-dashed border-gray-100" />

                    {/* Middle Row: Controls & Price */}
                    <div className="flex items-center justify-between gap-3">
                      {/* Quantity */}
                      <div className="flex items-center border border-gray-200 rounded-lg h-9 md:h-10 bg-gray-50">
                        <button type="button"
                          onClick={() =>
                            updateQuantity(item.cartItemId, item.quantity - 1)
                          }
                          className="px-3 h-full hover:bg-white text-gray-500 rounded-l-lg transition-colors border-r border-gray-200 active:bg-gray-200"
                          disabled={item.quantity <= 1}
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-8 text-center text-xs md:text-sm font-bold text-gray-900">
                          {item.quantity}
                        </span>
                        <button type="button"
                          onClick={() =>
                            updateQuantity(item.cartItemId, item.quantity + 1)
                          }
                          className="px-3 h-full hover:bg-white text-gray-500 rounded-r-lg transition-colors border-l border-gray-200 active:bg-gray-200"
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      {/* Price */}
                      <div className="text-right">
                        {isQuizGift ? (
                          <div className="font-bold text-store-primary text-base md:text-xl">
                            Free gift
                          </div>
                        ) : item.negotiatedPrice ? (
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] text-store-background-text/45 line-through decoration-store-primary/40">
                              ₦{((item.price || 0) * item.quantity).toLocaleString()}
                            </span>
                            <span className="font-bold text-store-primary text-base md:text-xl">
                              ₦{(itemTotal || 0).toLocaleString()}
                            </span>
                          </div>
                        ) : (
                          <div className="font-bold text-gray-900 text-base md:text-xl">
                            ₦{(itemTotal || 0).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Row: Actions */}
                    <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-3 justify-between items-center">
                      {/* Assurance/Insurance Toggle */}
                      {settings?.shipping_insurance_enabled && (
                        <label className="flex items-start gap-2 cursor-pointer select-none group active:opacity-70 max-w-[70%]">
                          <div className="relative flex items-center mt-0.5">
                            <input
                              type="checkbox"
                              checked={item.hasAssurance || false}
                              onChange={() => toggleAssurance?.(item.cartItemId)}
                              className="peer sr-only"
                            />
                            <div className="w-9 h-5 bg-store-background-text/20 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-store-primary-text after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-store-background after:border-store-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-store-primary" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                              <ShieldCheck size={12} className="text-store-primary" />
                              {merchantSlug === 'ogabassey' ? 'Ogabassey Assurance' : 'Order Protection'}
                            </span>
                            <p className="text-[10px] text-gray-500 leading-tight mt-0.5">
                              {item.hasAssurance ? (
                                <>
                                  {merchantSlug === 'ogabassey' ? (
                                    <>
                                      Covers{' '}
                                      <span className="font-bold text-gray-700">
                                        Screen & Liquid Damage
                                      </span>
                                    </>
                                  ) : (
                                    'Standard Shipping Protection'
                                  )}
                                  <span className="ml-1 text-store-primary font-bold">
                                    +₦{(assuranceCost || 0).toLocaleString()}
                                  </span>
                                </>
                              ) : (
                                `${merchantSlug === 'ogabassey' ? 'Device Protection' : 'Safety & Shipping Coverage'} (+${assuranceRateLabel})`
                              )}
                            </p>
                          </div>
                        </label>
                      )}

                      {/* Negotiate Button */}
                      {hasPriceNegotiation && !isQuizGift && (
                        <div className="flex items-center gap-2">
                          {item.negotiationStatus === 'accepted' ? (
                            <div className="flex items-center gap-1.5 text-xs font-bold text-store-primary bg-store-primary/5 px-3 py-1.5 rounded-lg border border-store-primary/15">
                              <Check size={12} strokeWidth={3} />
                              <span>
                                Matched @ ₦
                                {(item.negotiatedPrice || 0).toLocaleString()}
                              </span>
                            </div>
                          ) : isProductNegotiable({
                              brand: item.brand,
                              name: item.name,
                            }) ? (
                            <button type="button"
                              onClick={() => openItemNegotiation(item)}
                              className="flex items-center gap-1.5 text-xs font-bold text-store-primary md:hover:bg-store-primary/5 px-2 py-1.5 rounded-lg transition-colors border border-store-primary/15 md:hover:border-store-primary/40 active:bg-store-primary/5 active:scale-95"
                            >
                              <AppNegotiateIcon size={14} />
                              <span>Negotiate</span>
                            </button>
                          ) : (
                            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                              <Check size={12} strokeWidth={3} />
                              <span>Best price</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* In-feed Ad */}
              <AdUnit placementKey="PRODUCT_GRID_IN_FEED" />
            </div>

            {/* Right Column: Summary - Hidden on mobile as we use the sticky footer */}
            <div className="hidden lg:block lg:col-span-4 mt-6 lg:mt-0">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sticky top-24">

                <div className="space-y-3">
                  {hasPriceNegotiation && !hasNonNegotiableCartItem && (
                    <button type="button"
                      onClick={openTotalNegotiation}
                      className="w-full bg-gray-100 md:hover:bg-gray-200 text-gray-900 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors border border-gray-200 active:scale-[0.98] active:bg-gray-200"
                    >
                      <AppNegotiateIcon size={18} className="text-store-primary" />
                      Negotiate Total
                    </button>
                  )}

                  <button type="button"
                    onClick={handleCheckoutClick}
                    className="w-full bg-black hover:bg-gray-900 text-white font-bold py-3.5 px-4 rounded-xl items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98] active:shadow-none relative z-10 hidden md:flex"
                  >
                    Proceed to Checkout
                    <span className="opacity-50 mx-1">•</span>
                    <span>₦{(displayCartTotal || 0).toLocaleString()}</span>
                    <ArrowRight
                      size={20}
                      className="animate-slide-right ml-1"
                    />
                  </button>
                </div>

                <div className="mt-6 flex justify-center">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <ShieldCheck size={14} />
                    <span>Secure Checkout</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Negotiation Modal — only render when merchant context is available */}
      {negotiationState && merchant?.id && (
        <NegotiationModal
          isOpen={negotiationState.isOpen}
          onClose={() => setNegotiationState(null)}
          productName={negotiationState.name}
          currentPrice={negotiationState.currentPrice}
          vatRate={negotiationVatRate}
          onSuccess={handleNegotiationSuccess}
          type={negotiationState.type}
          merchantId={merchant.id}
          cart={cart}
        />
      )}

      {/* Checkout Identity Gate */}
      <CheckoutIdentityModal
        isOpen={isIdentityModalOpen}
        onClose={() => setIsIdentityModalOpen(false)}
        checkoutUrl={`${basePath}/checkout`}
      />

      {/* Mobile Sticky Footer - Only visible on mobile when cart has items */}
      {displayCart.length > 0 && (
        <div className="fixed bottom-24 left-0 right-0 bg-white border-t border-gray-200 p-3 flex items-center gap-2 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] md:hidden z-40">
          {/* Negotiate Icon Button */}
          {hasPriceNegotiation && !hasNonNegotiableCartItem && (
            <button type="button"
              onClick={openTotalNegotiation}
              className="h-14 px-3 flex flex-col items-center justify-center bg-gray-100 hover:bg-gray-200 active:bg-gray-200 rounded-xl border border-gray-200 transition-colors shrink-0"
              aria-label="Bulk Negotiate"
              title="Bulk Negotiate"
            >
              <AppNegotiateIcon size={24} className="text-store-primary" />
              <span className="text-[10px] font-bold text-gray-600 mt-0.5">Negotiate</span>
            </button>
          )}

          {/* Checkout Button */}
          <button type="button"
            onClick={handleCheckoutClick}
            className="flex-1 bg-red-600 hover:bg-red-700 active:bg-red-700 active:scale-[0.98] text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg"
          >
            <span>Checkout</span>
            <span className="opacity-50 mx-1">•</span>
            <span>₦{(displayCartTotal || 0).toLocaleString()}</span>
            <ArrowRight size={18} className="animate-slide-right ml-1" />
          </button>
        </div>
      )}
      {/* Negotiate Mode Warning Dialog */}
      {showNegotiateWarning && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="size-12 bg-amber-100 rounded-full flex items-center justify-center">
                <AppNegotiateIcon className="text-amber-600" size={24} />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Choose Negotiation Mode</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Negotiating items individually will disable bulk cart negotiation.
              <span className="font-semibold"> You can only use one approach.</span>
            </p>
            <div className="flex flex-col gap-3">
              <button type="button"
                onClick={() => {
                  if (pendingNegotiateItem) {
                    actuallyOpenItemNegotiation(pendingNegotiateItem);
                  }
                }}
                className="w-full bg-store-primary text-white font-bold py-3 px-4 rounded-xl hover:opacity-90 transition-opacity"
              >
                Negotiate This Item
              </button>
              <button type="button"
                onClick={() => {
                  if (hasNonNegotiableCartItem) return;
                  setShowNegotiateWarning(false);
                  setPendingNegotiateItem(null);
                  openTotalNegotiation();
                }}
                disabled={hasNonNegotiableCartItem}
                className="w-full bg-gray-100 text-gray-800 font-bold py-3 px-4 rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <AppNegotiateIcon size={18} />
                Bulk Negotiate Entire Cart
              </button>
              <button type="button"
                onClick={() => {
                  setShowNegotiateWarning(false);
                  setPendingNegotiateItem(null);
                }}
                className="w-full text-gray-500 font-medium py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
