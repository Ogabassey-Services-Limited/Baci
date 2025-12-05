// @ts-nocheck - Template preview component with different cart type system
import React, { useState } from 'react';
import { X, Minus, Plus, ShoppingBag, Trash2, ArrowRight, HandCoins, Check, Calculator, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useCart } from '@/hooks/use-cart';
import { AdUnit } from './AdUnit';
import { NegotiationModal } from './NegotiationModal';
import { EmptyState } from './empty-state';
import { CartItem } from '../types';

interface NegotiationState {
    isOpen: boolean;
    type: 'single' | 'total';
    item?: CartItem;
    currentPrice: number;
    name: string;
}

interface OgabasseyV2CartSidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export const OgabasseyV2CartSidebar: React.FC<OgabasseyV2CartSidebarProps> = ({ isOpen, onClose }) => {
    const { cart: mainCart, removeFromCart, updateQuantity } = useCart();
    // Cast cart to extended type for template preview compatibility
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cart = mainCart as any as CartItem[];
    // Stub functions for template preview (not available in main cart context)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const applyNegotiatedPrice = (_cartItemId: string, _price: number) => { console.log('Negotiation not available in preview'); };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const applyCartWideNegotiation = (_totalPrice: number) => { console.log('Cart-wide negotiation not available in preview'); };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const toggleAssurance = (_cartItemId: string) => { console.log('Assurance not available in preview'); };
    const [negotiationState, setNegotiationState] = useState<NegotiationState | null>(null);

    // Calculate subtotal
    const subtotal = cart.reduce((acc, item) => {
        const price = item.negotiatedPrice || item.rawPrice || 0;
        const itemTotal = price * item.quantity;
        const assuranceCost = item.hasAssurance ? (itemTotal * 0.05) : 0;
        return acc + itemTotal + assuranceCost;
    }, 0);

    if (!isOpen) return null;

    const handleNegotiationSuccess = (finalPrice: number) => {
        if (!negotiationState) return;

        if (negotiationState.type === 'single' && negotiationState.item) {
            // finalPrice is the negotiated TOTAL for the line item (Unit Price * Quantity)
            const quantity = negotiationState.item.quantity;
            const newUnitPrice = finalPrice / quantity;
            applyNegotiatedPrice(negotiationState.item.cartItemId, newUnitPrice);
        } else if (negotiationState.type === 'total') {
            applyCartWideNegotiation(finalPrice);
        }
        setNegotiationState(null);
    };

    const openItemNegotiation = (item: CartItem) => {
        const currentUnitPrice = item.negotiatedPrice || item.rawPrice;
        const currentTotal = currentUnitPrice * item.quantity;

        setNegotiationState({
            isOpen: true,
            type: 'single',
            item: item,
            currentPrice: currentTotal,
            name: item.quantity > 1 ? `${item.name} (x${item.quantity})` : item.name
        });
    };

    const openTotalNegotiation = () => {
        setNegotiationState({
            isOpen: true,
            type: 'total',
            currentPrice: subtotal,
            name: "Entire Cart"
        });
    };

    return (
        <>
            {/* High Z-Index to cover Mobile Footer (z-40) */}
            <div className="fixed inset-0 z-[60] overflow-hidden">
                {/* Backdrop */}
                <div
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                    onClick={onClose}
                ></div>

                {/* Sidebar Panel - SWIPES FROM LEFT */}
                <div className="absolute inset-y-0 left-0 max-w-full flex">
                    <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-left duration-300">

                        {/* Header */}
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
                            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <ShoppingBag className="text-red-600" />
                                Your Cart
                                <span className="text-sm font-medium text-gray-500 ml-2">({cart.length} items)</span>
                            </h2>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500 hover:text-red-600"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Cart Items List */}
                        <div className={`flex-1 overflow-y-auto p-6 ${cart.length === 0 ? 'flex flex-col' : 'space-y-6'}`}>
                            {cart.length === 0 ? (
                                <div className="flex-1 flex items-center justify-center">
                                    <EmptyState
                                        variant="cart"
                                        title="Your cart is empty 🤧"
                                        description="Sorry, the product you are looking for is currently not available at the moment."
                                        actionLabel="Start Shopping"
                                        onAction={onClose}
                                    />
                                </div>
                            ) : (
                                <>
                                    {cart.map((item) => {
                                        const priceToUse = item.negotiatedPrice !== undefined ? item.negotiatedPrice : item.rawPrice;
                                        const itemTotal = priceToUse * item.quantity;
                                        const assuranceCost = item.hasAssurance ? (itemTotal * 0.05) : 0;

                                        const productHref = `/product/${item.id}`;
                                        return (
                                            <div key={item.cartItemId} className="flex gap-4 animate-in fade-in duration-300 border-b border-gray-50 pb-6 last:border-0 last:pb-0">
                                                {/* @ts-expect-error - dynamic product route in template */}
                                                <Link href={productHref} className="w-24 h-24 bg-gray-50 rounded-lg border border-gray-100 p-2 flex-shrink-0 self-start mt-1 block">
                                                    <img src={item.image} alt={item.name} className="w-full h-full object-contain mix-blend-multiply" />
                                                </Link>
                                                <div className="flex-1 flex flex-col justify-between min-h-[100px]">
                                                    <div>
                                                        <div className="flex justify-between items-start">
                                                            {/* @ts-expect-error - dynamic product route in template */}
                                                            <Link href={productHref} className="font-bold text-gray-900 line-clamp-1 text-sm hover:text-red-600 transition-colors">
                                                                {item.name}
                                                            </Link>
                                                            <button
                                                                onClick={() => removeFromCart(item.cartItemId)}
                                                                className="text-gray-400 hover:text-red-600 p-1 -mt-1 -mr-1"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>

                                                        {/* Item Details: Condition & Color */}
                                                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                                            {/* Condition Badge */}
                                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${item.condition === 'New'
                                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                                    : 'bg-amber-50 text-amber-700 border-amber-100'
                                                                }`}>
                                                                {item.condition}
                                                            </span>

                                                            {/* Color & Storage */}
                                                            <div className="text-xs text-gray-500 flex items-center gap-1">
                                                                {item.selectedColor && (
                                                                    <span className="flex items-center gap-1">
                                                                        <span
                                                                            className="w-2.5 h-2.5 rounded-full border border-gray-300 shadow-sm"
                                                                            style={{ backgroundColor: item.selectedColorValue || item.selectedColor }}
                                                                        ></span>
                                                                        {item.selectedColor}
                                                                    </span>
                                                                )}
                                                                {item.secondaryColor && (
                                                                    <span className="text-[10px] text-blue-500">(Pref 2: {item.secondaryColor})</span>
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
                                                                    onClick={() => updateQuantity(item.cartItemId, -1)}
                                                                    className="p-1 px-2 hover:bg-gray-50 text-gray-500"
                                                                    disabled={item.quantity <= 1}
                                                                >
                                                                    <Minus size={12} />
                                                                </button>
                                                                <span className="w-6 text-center text-xs font-medium">{item.quantity}</span>
                                                                <button
                                                                    onClick={() => updateQuantity(item.cartItemId, 1)}
                                                                    className="p-1 px-2 hover:bg-gray-50 text-gray-500"
                                                                >
                                                                    <Plus size={12} />
                                                                </button>
                                                            </div>

                                                            {/* Negotiation - Bottom Left */}
                                                            {item.negotiationStatus === 'accepted' ? (
                                                                <div className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-md w-fit border border-green-100">
                                                                    <Check size={10} strokeWidth={3} />
                                                                    <span>Matched @ ₦{item.negotiatedPrice?.toLocaleString()}</span>
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
                                                                    <span className="text-[10px] text-gray-400 line-through decoration-red-400">₦{(item.rawPrice * item.quantity).toLocaleString()}</span>
                                                                    <span className="font-bold text-green-600 text-sm">₦{itemTotal.toLocaleString()}</span>
                                                                </div>
                                                            ) : (
                                                                <div className="font-bold text-gray-900 text-sm">
                                                                    ₦{itemTotal.toLocaleString()}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Ogabassey Assurance Toggle */}
                                                    <div className="mt-4 pt-3 border-t border-gray-50">
                                                        <label className="flex items-start gap-2 cursor-pointer group">
                                                            <div className="relative flex items-center mt-0.5">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={item.hasAssurance || false}
                                                                    onChange={() => toggleAssurance(item.cartItemId)}
                                                                    className="peer sr-only"
                                                                />
                                                                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
                                                            </div>
                                                            <div className="flex-1">
                                                                <div className="flex justify-between items-center">
                                                                    <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                                                                        <ShieldCheck size={12} className="text-red-600" />
                                                                        Ogabassey Assurance
                                                                    </span>
                                                                    {item.hasAssurance && (
                                                                        <span className="text-xs font-bold text-gray-900">+₦{assuranceCost.toLocaleString()}</span>
                                                                    )}
                                                                </div>
                                                                <p className="text-[10px] text-gray-500 leading-tight mt-0.5">
                                                                    {item.hasAssurance ? (
                                                                        <>Covers <span className="font-bold text-gray-700">Screen & Liquid Damage</span></>
                                                                    ) : (
                                                                        "Device Protection (+5%)"
                                                                    )}
                                                                </p>
                                                            </div>
                                                        </label>
                                                    </div>

                                                </div>
                                            </div>
                                        )
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
                                        <span>₦{subtotal.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-600">
                                        <span>Shipping</span>
                                        <span className="text-green-600">Calculated at checkout</span>
                                    </div>
                                    <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t border-gray-200">
                                        <span>Total</span>
                                        <span>₦{subtotal.toLocaleString()}</span>
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

                                <button className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-red-200 group">
                                    Proceed to Checkout
                                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                </button>
                                <button
                                    onClick={onClose}
                                    className="w-full text-center text-gray-500 hover:text-gray-900 text-sm font-medium"
                                >
                                    Continue Shopping
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Negotiation Modal */}
            {negotiationState && (
                <NegotiationModal
                    isOpen={negotiationState.isOpen}
                    onClose={() => setNegotiationState(null)}
                    productName={negotiationState.name}
                    currentPrice={negotiationState.currentPrice}
                    onSuccess={handleNegotiationSuccess}
                />
            )}
        </>
    );
};
