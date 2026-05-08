'use client';

import { ArrowLeft, Check, CreditCard, Lock, Truck } from 'lucide-react';
import Link from 'next/link';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useCart } from '@/hooks/use-cart';
import { useMerchantSafe } from '@/hooks/use-merchant';
import { asRoute } from '@/lib/routes';
import { Footer } from './footer';
import { Navbar } from './navbar';

export const CheckoutPage: React.FC = () => {
  const { cart, cartTotal } = useCart();
  const [isClient, setIsClient] = useState(false);
  const [step, setStep] = useState(1); // 1: Shipping, 2: Payment, 3: Success
  const merchantContext = useMerchantSafe();
  const basePath = merchantContext?.basePath || '';
  const getHref = (path: string) => path.startsWith('http') ? path : `${basePath}${path}`;

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return null;
  }

  if (cart.length === 0 && step !== 3) {
    return (
      <div className="min-h-screen bg-gray-50 font-sans flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Your cart is empty</h1>
          <Link href={asRoute(getHref('/'))} className="text-red-600 hover:underline">
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />

      <main className="max-w-[1400px] mx-auto px-4 md:px-6 py-8 md:py-12">
        <div className="flex items-center gap-2 mb-8">
          <Link
            href={asRoute(getHref('/cart'))}
            className="flex items-center gap-2 text-gray-500 hover:text-red-600 transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="font-medium">Back to Cart</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Steps */}
            <div className="flex items-center justify-between mb-8 px-4">
              <div
                className={`flex flex-col items-center gap-2 ${step >= 1 ? 'text-red-600' : 'text-gray-400'}`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step >= 1 ? 'bg-red-600 text-white' : 'bg-gray-200'}`}
                >
                  {step > 1 ? <Check size={20} /> : '1'}
                </div>
                <span className="text-sm font-bold">Shipping</span>
              </div>
              <div
                className={`flex-1 h-1 mx-4 rounded-full ${step >= 2 ? 'bg-red-600' : 'bg-gray-200'}`}
              />
              <div
                className={`flex flex-col items-center gap-2 ${step >= 2 ? 'text-red-600' : 'text-gray-400'}`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step >= 2 ? 'bg-red-600 text-white' : 'bg-gray-200'}`}
                >
                  {step > 2 ? <Check size={20} /> : '2'}
                </div>
                <span className="text-sm font-bold">Payment</span>
              </div>
              <div
                className={`flex-1 h-1 mx-4 rounded-full ${step >= 3 ? 'bg-red-600' : 'bg-gray-200'}`}
              />
              <div
                className={`flex flex-col items-center gap-2 ${step >= 3 ? 'text-red-600' : 'text-gray-400'}`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step >= 3 ? 'bg-red-600 text-white' : 'bg-gray-200'}`}
                >
                  3
                </div>
                <span className="text-sm font-bold">Confirmation</span>
              </div>
            </div>

            {step === 1 && (
              <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100 animate-in slide-in-from-left-4 duration-300">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                  <Truck className="text-red-600" />
                  Shipping Information
                </h2>
                <form className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        First Name
                      </label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-red-600 focus:ring-4 focus:ring-red-50 outline-hidden transition-all"
                        placeholder="John"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        Last Name
                      </label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-red-600 focus:ring-4 focus:ring-red-50 outline-hidden transition-all"
                        placeholder="Doe"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-red-600 focus:ring-4 focus:ring-red-50 outline-hidden transition-all"
                      placeholder="john@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Address
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-red-600 focus:ring-4 focus:ring-red-50 outline-hidden transition-all"
                      placeholder="123 Main St"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        City
                      </label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-red-600 focus:ring-4 focus:ring-red-50 outline-hidden transition-all"
                        placeholder="Lagos"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        State
                      </label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-red-600 focus:ring-4 focus:ring-red-50 outline-hidden transition-all"
                        placeholder="Lagos"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        Zip Code
                      </label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-red-600 focus:ring-4 focus:ring-red-50 outline-hidden transition-all"
                        placeholder="100001"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg shadow-red-600/20 active:scale-[0.98]"
                  >
                    Continue to Payment
                  </button>
                </form>
              </div>
            )}

            {step === 2 && (
              <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100 animate-in slide-in-from-right-4 duration-300">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                  <CreditCard className="text-red-600" />
                  Payment Method
                </h2>

                <div className="space-y-4 mb-8">
                  <label className="flex items-center gap-4 p-4 border border-red-600 bg-red-50 rounded-xl cursor-pointer">
                    <div className="w-5 h-5 rounded-full border-2 border-red-600 flex items-center justify-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-600" />
                    </div>
                    <div className="flex-1">
                      <span className="font-bold text-gray-900 block">
                        Paystack
                      </span>
                      <span className="text-sm text-gray-500">
                        Pay with Card, Bank Transfer, or USSD
                      </span>
                    </div>
                    <img
                      src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/MasterCard_Logo.svg/2560px-MasterCard_Logo.svg.png"
                      alt="Mastercard"
                      className="h-6"
                    />
                  </label>

                  <label className="flex items-center gap-4 p-4 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50">
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                    <div className="flex-1">
                      <span className="font-bold text-gray-900 block">
                        Bank Transfer
                      </span>
                      <span className="text-sm text-gray-500">
                        Direct transfer to our bank account
                      </span>
                    </div>
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg shadow-red-600/20 active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Lock size={18} />
                  Pay ₦{cartTotal.toLocaleString()}
                </button>
              </div>
            )}

            {step === 3 && (
              <div className="bg-white p-12 rounded-3xl shadow-sm border border-gray-100 text-center animate-in zoom-in-95 duration-300">
                <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Check size={48} strokeWidth={3} />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                  Order Confirmed!
                </h2>
                <p className="text-gray-500 mb-8 max-w-md mx-auto">
                  Thank you for your purchase. Your order #12345 has been
                  confirmed and will be shipped shortly.
                </p>
                <Link
                  href={asRoute(getHref('/'))}
                  className="inline-flex items-center gap-2 bg-gray-900 text-white font-bold py-3.5 px-8 rounded-xl hover:bg-gray-800 transition-all"
                >
                  Continue Shopping
                </Link>
              </div>
            )}
          </div>

          {/* Order Summary Sidebar */}
          {step < 3 && (
            <div className="lg:col-span-1">
              <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100 sticky top-24">
                <h3 className="font-bold text-xl text-gray-900 mb-6">
                  Order Summary
                </h3>

                <div className="space-y-4 mb-6 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {cart.map((item: any) => (
                    <div
                      key={item.variant_id || item.id}
                      className="flex gap-3"
                    >
                      <div className="w-16 h-16 bg-gray-50 rounded-lg p-1 shrink-0">
                        <img
                          src={item.image}
                          alt=""
                          className="w-full h-full object-contain mix-blend-multiply"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-gray-900 truncate">
                          {item.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          Qty: {item.quantity}
                        </p>
                        <p className="font-bold text-sm text-red-600">
                          ₦{(item.price * item.quantity).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-100 pt-4 space-y-3 mb-6">
                  <div className="flex justify-between text-gray-600 text-sm">
                    <span>Subtotal</span>
                    <span className="font-bold text-gray-900">
                      ₦{cartTotal.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-600 text-sm">
                    <span>Delivery</span>
                    <span className="text-green-600 font-medium">Free</span>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-4">
                  <div className="flex justify-between items-end">
                    <span className="font-bold text-gray-900">Total</span>
                    <span className="font-bold text-2xl text-gray-900">
                      ₦{cartTotal.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="mt-6 flex items-center gap-2 text-xs text-gray-400 justify-center">
                  <Lock size={12} />
                  <span>Encrypted & Secure Payment</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};
