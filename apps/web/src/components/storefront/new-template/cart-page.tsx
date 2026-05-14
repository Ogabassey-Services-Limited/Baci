'use client';

import {
  ArrowLeft,
  ArrowRight,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useCart } from '@/hooks/use-cart';
import { useMerchantSafe } from '@/hooks/use-merchant-client';
import { asRoute } from '@/lib/routes';
import { Footer } from './footer';
import { Navbar } from './navbar';

export const CartPage: React.FC = () => {
  const { cart, updateQuantity, removeFromCart, cartTotal } = useCart();
  const [isClient, setIsClient] = useState(false);
  const merchantContext = useMerchantSafe();
  const basePath = merchantContext?.basePath || '';
  const getHref = (path: string) => path.startsWith('http') ? path : `${basePath}${path}`;

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return null; // Prevent hydration mismatch
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />

      <main className="max-w-[1400px] mx-auto px-4 md:px-6 py-8 md:py-12">
        <div className="flex items-center gap-2 mb-8">
          <Link
            href={asRoute(getHref('/'))}
            className="flex items-center gap-2 text-gray-500 hover:text-red-600 transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="font-medium">Continue Shopping</span>
          </Link>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8">
          Your Cart{' '}
          <span className="text-gray-400 font-normal">
            ({cart.length} items)
          </span>
        </h1>

        {cart.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-gray-100">
            <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300">
              <ShoppingBag size={40} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Your cart is empty
            </h2>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              Looks like you haven't added anything to your cart yet. Browse our
              products to find great deals!
            </p>
            <Link
              href={asRoute(getHref('/'))}
              className="inline-flex items-center gap-2 bg-red-600 text-white font-bold py-3.5 px-8 rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-6">
              {cart.map((item: any) => (
                <div
                  key={item.variant_id || item.id}
                  className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100 flex gap-4 md:gap-6 group transition-all hover:shadow-md"
                >
                  <div className="w-24 h-24 md:w-32 md:h-32 bg-gray-50 rounded-xl flex-shrink-0 p-2">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-contain mix-blend-multiply"
                    />
                  </div>

                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-4">
                        <h3 className="font-bold text-gray-900 text-lg leading-tight mb-1">
                          {item.name}
                        </h3>
                        <button type="button"
                          onClick={() =>
                            removeFromCart(item.id, item.variant_id)
                          }
                          className="text-gray-400 hover:text-red-600 transition-colors p-1"
                          aria-label="Remove item"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-2 text-sm text-gray-500 mb-3">
                        {item.variantColor && (
                          <span className="bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                            {item.variantColor}
                          </span>
                        )}
                        {item.variantStorage && (
                          <span className="bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                            {item.variantStorage}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-end justify-between gap-4">
                      <div className="flex items-center bg-gray-100 rounded-lg p-1">
                        <button type="button"
                          onClick={() =>
                            updateQuantity(
                              item.id,
                              Math.max(1, item.quantity - 1),
                              item.variant_id
                            )
                          }
                          className="w-8 h-8 flex items-center justify-center rounded-md bg-white text-gray-600 shadow-sm hover:text-red-600 disabled:opacity-50"
                          disabled={item.quantity <= 1}
                          aria-label="Decrease quantity"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-10 text-center font-bold text-sm text-gray-900">
                          {item.quantity}
                        </span>
                        <button type="button"
                          onClick={() =>
                            updateQuantity(
                              item.id,
                              item.quantity + 1,
                              item.variant_id
                            )
                          }
                          className="w-8 h-8 flex items-center justify-center rounded-md bg-white text-gray-600 shadow-sm hover:text-red-600"
                          aria-label="Increase quantity"
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      <div className="text-right">
                        <p className="font-bold text-xl text-red-600">
                          ₦{(item.price * item.quantity).toLocaleString()}
                        </p>
                        {item.quantity > 1 && (
                          <p className="text-xs text-gray-400">
                            ₦{item.price.toLocaleString()} each
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100 sticky top-24">
                <h3 className="font-bold text-xl text-gray-900 mb-6">
                  Order Summary
                </h3>

                <div className="space-y-4 mb-6">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span className="font-bold text-gray-900">
                      ₦{cartTotal.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Delivery</span>
                    <span className="text-green-600 font-medium">Free</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Tax</span>
                    <span className="text-gray-400">
                      Calculated at checkout
                    </span>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-4 mb-8">
                  <div className="flex justify-between items-end">
                    <span className="font-bold text-gray-900">Total</span>
                    <span className="font-bold text-3xl text-gray-900">
                      ₦{cartTotal.toLocaleString()}
                    </span>
                  </div>
                </div>

                <Link
                  href={asRoute(getHref('/checkout'))}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-600/20 active:scale-[0.98] mb-4"
                >
                  <span>Proceed to Checkout</span>
                  <ArrowRight size={20} />
                </Link>

                <div className="flex items-center gap-3 justify-center text-gray-500 text-xs">
                  <ShieldCheck size={16} className="text-green-600" />
                  <span>Secure Checkout & Buyer Protection</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};
