'use client';

import { ChevronDown, ChevronRight, ChevronUp, Loader2, ShoppingBag } from 'lucide-react';
import type React from 'react';
import { useId, useState } from 'react';
import { CdnFormatImage } from '@/components/storefront/cdn-format-image';
import type { CartItem } from '@/hooks/cart';
import { useCurrency } from '@/hooks/use-currency';
import type { DeliveryMethod } from '../pages/checkout/types';

// --- Types ---

interface MobileOrderSummaryProps {
    cart: CartItem[];
    cartTotal: number;
    deliveryCost: number;
    deliveryMethod: DeliveryMethod | null;
    giftWrappingCost: number;
    walletBalance: number;
    payWithWallet: boolean;
    walletAmountUsed: number;
    remainingAmount: number;
}

interface MobileCheckoutActionsProps {
    currentStep: 'contact' | 'delivery' | 'payment';
    completedSteps: { contact: boolean; delivery: boolean };
    onNext: () => void;
    isProcessing: boolean;
    totalDisplay: number; // The amount to show in the bar (remaining amount)
    paymentMethod: string;
    isPayForMeValid: boolean;
    originalTotal: number;
}


// --- Components ---

export const MobileOrderSummary: React.FC<MobileOrderSummaryProps> = ({
    cart,
    cartTotal,
    deliveryCost,
    deliveryMethod,
    giftWrappingCost,
    walletBalance: _walletBalance,
    payWithWallet,
    walletAmountUsed,
    remainingAmount,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const orderSummaryId = useId();
    const { formatCurrencyAuto, currencyCode } = useCurrency();

    return (
        <div className="lg:hidden bg-gray-50 border-b border-gray-200">
            <div className="max-w-[1400px] mx-auto px-4">
                {/* Toggle Header */}
                <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-controls={orderSummaryId}
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full py-4 flex items-center justify-between text-sm"
                >
                    <div className="flex items-center gap-2 text-red-600 font-medium">
                        <ShoppingBag size={18} />
                        <span>{isExpanded ? 'Hide' : 'Show'} order summary</span>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                    <span className="font-bold text-gray-900 text-lg">
                        {formatCurrencyAuto(remainingAmount)}
                    </span>
                </button>

                {/* Collapsible Content */}
                <div
                    id={orderSummaryId}
                    aria-hidden={!isExpanded}
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'visible max-h-[80vh] opacity-100 pb-6' : 'invisible max-h-0 opacity-0'
                        }`}
                >
                    {/* Items List */}
                    <div className="space-y-4 mb-6 pt-2">
                        {cart.map((item) => (
                            <div key={item.cartItemId} className="flex gap-3">
                                <div className="ogabassey-product-card-image-surface relative size-16 bg-white rounded-lg border border-gray-100 p-1 shrink-0">
                                    <CdnFormatImage
                                        src={item.image || '/placeholder.png'}
                                        alt={item.name}
                                        fill
                                        sizes="64px"
                                        className="object-contain mix-blend-multiply"
                                    />
                                    <span className="absolute -top-2 -right-2 size-5 bg-gray-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                        {item.quantity}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0 py-1">
                                    <p className="text-sm font-bold text-gray-900 line-clamp-2 leading-snug">
                                        {item.name}
                                    </p>
                                    <p className="text-sm text-gray-500 mt-1">
                                        {formatCurrencyAuto(item.negotiatedPrice || item.price)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="border-t border-dashed border-gray-200 my-4" />

                    {/* Cost Breakdown */}
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between text-gray-600">
                            <span>Subtotal</span>
                            <span>{formatCurrencyAuto(cartTotal)}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                            <span>Delivery</span>
                            <span className={deliveryCost === 0 ? 'text-green-600 font-medium' : 'text-gray-900'}>
                                {deliveryMethod === 'door' && deliveryCost === 0
                                    ? 'Calculated at next step'
                                    : deliveryCost === 0 ? 'Free' : formatCurrencyAuto(deliveryCost)}
                            </span>
                        </div>
                        {giftWrappingCost > 0 && (
                            <div className="flex justify-between text-gray-600">
                                <span>Gift Wrapping</span>
                                <span>{formatCurrencyAuto(giftWrappingCost)}</span>
                            </div>
                        )}
                        {payWithWallet && walletAmountUsed > 0 && (
                            <div className="flex justify-between text-green-600 font-medium">
                                <span>Wallet Credit</span>
                                <span>-{formatCurrencyAuto(walletAmountUsed)}</span>
                            </div>
                        )}
                    </div>

                    <div className="border-t border-gray-200 my-4" />

                    <div className="flex justify-between text-base font-bold text-gray-900 items-baseline">
                        <span>Total</span>
                        <div className="text-right">
                            <span className="text-xs text-gray-400 font-normal mr-2">{currencyCode}</span>
                            <span className="text-xl">{formatCurrencyAuto(remainingAmount)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const MobileCheckoutActions: React.FC<MobileCheckoutActionsProps> = ({
    currentStep,
    completedSteps,
    onNext,
    isProcessing,
    totalDisplay,
    paymentMethod,
    isPayForMeValid,
}) => {
    const { formatCurrencyAuto } = useCurrency();
    // Determine button text and disabled state based on step
    let buttonText = 'Continue';
    let isDisabled = false;

    if (currentStep === 'contact') {
        buttonText = 'Continue to Delivery';
        // Logic for contact disabled state is handled inside the click handler via validation
        // but we can pass validation status if needed. For now, rely on parent validation.
    } else if (currentStep === 'delivery') {
        buttonText = 'Continue to Payment';
        isDisabled = !completedSteps.contact; // Can't skip to delivery if contact not done
    } else if (currentStep === 'payment') {
        if (paymentMethod === 'invoice') buttonText = 'Generate Invoice';
        else if (paymentMethod === 'payforme') buttonText = 'Send Payment Link';
        else buttonText = 'Place Order';

        // Disable if amount remains but no method selected
        if (totalDisplay > 0 && !paymentMethod) isDisabled = true;
        if (paymentMethod === 'payforme' && !isPayForMeValid) isDisabled = true;
    }

    return (
        <div className="fixed bottom-20 left-0 right-0 bg-white border-t border-gray-200 p-4 pb-safe-area lg:hidden z-50 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
            <div className="flex items-center gap-4">
                {/* Total displayed next to button for context */}
                <div className="shrink-0">
                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Total</p>
                    <p className="text-lg font-bold text-gray-900 leading-tight">
                        {formatCurrencyAuto(totalDisplay)}
                    </p>
                </div>

                <button type="button"
                    onClick={onNext}
                    disabled={isDisabled || isProcessing}
                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg hover:shadow-red-200"
                >
                    {isProcessing ? (
                        <Loader2 className="animate-spin" size={20} />
                    ) : (
                        <>
                            {buttonText}
                            <ChevronRight size={18} />
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};
