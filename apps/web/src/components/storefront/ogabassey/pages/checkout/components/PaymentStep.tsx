'use client';

import { Check, ChevronRight, CreditCard, Loader2, Truck } from 'lucide-react';
import { useEffect } from 'react';
import {
  PaystackLogo,
  CredPalLogo,
  CreditDirectLogo,
  JuicywayLogo,
  BankTransferLogo,
} from '../../../components/PaymentLogos';
import {
  isBankTransferCheckoutAvailable,
  isPaystackCheckoutAvailable,
} from '@/lib/checkout/payment-gateway-availability';
import type { PaymentMethod, PaymentTab } from '../types';

type StepName = 'contact' | 'delivery' | 'payment';

interface CompletedSteps {
  contact: boolean;
  delivery: boolean;
}

interface FeatureSettings {
  paystack_enabled?: boolean;
  juicyway_enabled?: boolean;
  pay_on_delivery_enabled?: boolean;
  credpal_enabled?: boolean;
  credit_direct_enabled?: boolean;
}

function isPaymentMethodAvailable({
  paymentMethod,
  paystackCheckoutAvailable,
  bankTransferCheckoutAvailable,
  featureSettings,
}: {
  paymentMethod: PaymentMethod;
  paystackCheckoutAvailable: boolean;
  bankTransferCheckoutAvailable: boolean;
  featureSettings?: FeatureSettings | null;
}): boolean {
  switch (paymentMethod) {
    case 'paystack':
      return paystackCheckoutAvailable;
    case 'bank_transfer':
      return bankTransferCheckoutAvailable;
    case 'juicyway':
      return featureSettings?.juicyway_enabled === true;
    case 'pod':
      return featureSettings?.pay_on_delivery_enabled === true;
    case 'credpal':
      return featureSettings?.credpal_enabled === true;
    case 'credit_direct':
      return featureSettings?.credit_direct_enabled === true;
    case 'invoice':
    case 'payforme':
      return true;
    case 'korapay':
    case '':
    default:
      return false;
  }
}

interface PaymentStepProps {
  currentStep: StepName;
  completedSteps: CompletedSteps;
  paymentTab: PaymentTab;
  setPaymentTab: (v: PaymentTab) => void;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (v: PaymentMethod) => void;
  isProcessing: boolean;
  isPayForMeValid: boolean;
  isDeliveryValid: boolean;
  payForMeDetails: { name: string; contact: string; note: string };
  setPayForMeDetails: (v: { name: string; contact: string; note: string }) => void;
  dva: { isInitializingDva: boolean };
  newsletterOptIn: boolean;
  setNewsletterOptIn: (v: boolean) => void;
  handlePlaceOrder: () => void;
  setCurrentStep: (step: StepName) => void;
  merchant:
    | {
        paystack_subaccount_code?: string | null;
        feature_settings?: FeatureSettings | null;
      }
    | null
    | undefined;
  user: { id: string } | null | undefined;
  remainingAmount: number;
}

export function PaymentStep({
  currentStep,
  completedSteps,
  paymentTab,
  setPaymentTab,
  paymentMethod,
  setPaymentMethod,
  isProcessing,
  isPayForMeValid,
  isDeliveryValid,
  payForMeDetails,
  setPayForMeDetails,
  dva,
  newsletterOptIn,
  setNewsletterOptIn,
  handlePlaceOrder,
  setCurrentStep,
  merchant,
  user,
  remainingAmount,
}: PaymentStepProps) {
  const paystackCheckoutAvailable = isPaystackCheckoutAvailable(merchant);
  const bankTransferCheckoutAvailable =
    isBankTransferCheckoutAvailable(merchant);
  const hasAvailableSelectedPaymentMethod = isPaymentMethodAvailable({
    paymentMethod,
    paystackCheckoutAvailable,
    bankTransferCheckoutAvailable,
    featureSettings: merchant?.feature_settings,
  });

  useEffect(() => {
    if (paymentMethod && !hasAvailableSelectedPaymentMethod) {
      setPaymentMethod('');
    }
  }, [
    hasAvailableSelectedPaymentMethod,
    paymentMethod,
    setPaymentMethod,
  ]);

  return (
    <div className={`bg-white rounded-2xl shadow-sm border ${currentStep === 'payment' ? 'border-(--store-primary) ring-1 ring-(--store-primary)/20' : 'border-gray-100'} overflow-hidden transition-all duration-300`}>
      <button
        type="button"
        onClick={() => completedSteps.delivery && setCurrentStep('payment')}
        disabled={!completedSteps.delivery}
        className="w-full px-6 py-4 flex items-center justify-between text-left disabled:opacity-50 disabled:cursor-not-allowed hidden-disabled"
      >
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-colors ${hasAvailableSelectedPaymentMethod ? 'bg-green-100 text-green-600' : currentStep === 'payment' ? 'bg-(--store-primary)/10 text-(--store-primary)' : 'bg-gray-100 text-gray-500'
            }`}>
            {hasAvailableSelectedPaymentMethod ? <Check size={14} /> : '3'}
          </div>
          Payment Method
        </h2>
      </button>

      <div className={`grid transition-all duration-300 ease-in-out ${currentStep === 'payment' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <div className="p-6 pt-0 space-y-4">
            {/* Payment Tab Selector */}
            <div className="flex p-1 bg-gray-100 rounded-xl">
              <button
                type="button"
                onClick={() => { setPaymentTab('full'); setPaymentMethod(''); }}
                className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-bold transition-all ${paymentTab === 'full'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
                  }`}
              >
                Pay in Full
              </button>
              <button
                type="button"
                onClick={() => { setPaymentTab('installments'); setPaymentMethod(''); }}
                className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-bold transition-all ${paymentTab === 'installments'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
                  }`}
              >
                Pay in Installments
              </button>
            </div>

            {/* Pay in Full Options */}
            {paymentTab === 'full' && (
              <div className="space-y-3 animate-in fade-in">
                <p className="text-xs text-gray-500">Select a payment gateway:</p>
                <div className="grid grid-cols-1 gap-3">
                  {/* Paystack */}
                  {paystackCheckoutAvailable && (
                    <label
                      className={`relative flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === 'paystack'
                        ? 'border-(--store-primary) bg-(--store-primary)/5'
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                        }`}
                    >
                      <input
                        type="radio"
                        name="payment"
                        value="paystack"
                        checked={paymentMethod === 'paystack'}
                        onChange={() => setPaymentMethod('paystack')}
                        className="sr-only"
                      />
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'paystack' ? 'border-(--store-primary)' : 'border-gray-400'}`}>
                        {paymentMethod === 'paystack' && <div className="w-2.5 h-2.5 rounded-full bg-(--store-primary)" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-gray-900">Paystack</span>
                          <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Popular</span>
                        </div>
                        <span className="text-xs text-gray-500 block mt-0.5">Card, Bank Transfer, USSD</span>
                      </div>
                      <PaystackLogo className="w-6 h-6" />
                    </label>
                  )}

                  {/* Bank Transfer (DVA) - Premium Option */}
                  {bankTransferCheckoutAvailable && (
                    <label
                      className={`relative flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === 'bank_transfer'
                        ? 'border-(--store-primary) bg-(--store-primary)/5'
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                        }`}
                    >
                      <input
                        type="radio"
                        name="payment"
                        value="bank_transfer"
                        checked={paymentMethod === 'bank_transfer'}
                        onChange={() => setPaymentMethod('bank_transfer')}
                        className="sr-only"
                      />
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'bank_transfer' ? 'border-(--store-primary)' : 'border-gray-400'}`}>
                        {paymentMethod === 'bank_transfer' && <div className="w-2.5 h-2.5 rounded-full bg-(--store-primary)" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-gray-900">Bank Transfer</span>
                          <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">Automatic</span>
                        </div>
                        <span className="text-xs text-gray-500 block mt-0.5">Pay to a unique virtual account</span>
                      </div>
                      <BankTransferLogo className="w-6 h-6" />
                    </label>
                  )}

                  {/* Korapay - Disabled until API keys are configured */}
                  {/* TODO: Re-enable when KORAPAY_SECRET_KEY and KORAPAY_PUBLIC_KEY are added to .env.local
                  <label
                    className={`relative flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === 'korapay'
                      ? 'border-(--store-primary) bg-(--store-primary)/5'
                      : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                      }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value="korapay"
                      checked={paymentMethod === 'korapay'}
                      onChange={() => setPaymentMethod('korapay')}
                      className="sr-only"
                    />
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'korapay' ? 'border-(--store-primary)' : 'border-gray-400'}`}>
                      {paymentMethod === 'korapay' && <div className="w-2.5 h-2.5 rounded-full bg-(--store-primary)" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-gray-900">Korapay</span>
                      </div>
                      <span className="text-xs text-gray-500 block mt-0.5">Other African Countries</span>
                    </div>
                    <KorapayLogo className="w-6 h-6" />
                  </label>
                  */}

                  {/* Juicyway */}
                  {merchant?.feature_settings?.juicyway_enabled === true && (
                    <label
                      className={`relative flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === 'juicyway'
                        ? 'border-(--store-primary) bg-(--store-primary)/5'
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                        }`}
                    >
                      <input
                        type="radio"
                        name="payment"
                        value="juicyway"
                        checked={paymentMethod === 'juicyway'}
                        onChange={() => setPaymentMethod('juicyway')}
                        className="sr-only"
                      />
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'juicyway' ? 'border-(--store-primary)' : 'border-gray-400'}`}>
                        {paymentMethod === 'juicyway' && <div className="w-2.5 h-2.5 rounded-full bg-(--store-primary)" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-gray-900">Juicyway</span>
                          <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">Crypto</span>
                        </div>
                        <span className="text-xs text-gray-500 block mt-0.5">USDT, USDC etc</span>
                      </div>
                      <JuicywayLogo className="w-6 h-6" />
                    </label>
                  )}

                  {/* Pay on Delivery */}
                  {merchant?.feature_settings?.pay_on_delivery_enabled === true && (
                    <label
                      className={`relative flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === 'pod'
                        ? 'border-(--store-primary) bg-(--store-primary)/5'
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                        }`}
                    >
                      <input
                        type="radio"
                        name="payment"
                        value="pod"
                        checked={paymentMethod === 'pod'}
                        onChange={() => setPaymentMethod('pod')}
                        className="sr-only"
                      />
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'pod' ? 'border-(--store-primary)' : 'border-gray-400'}`}>
                        {paymentMethod === 'pod' && <div className="w-2.5 h-2.5 rounded-full bg-(--store-primary)" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-gray-900">Pay on Delivery</span>
                        </div>
                        <span className="text-xs text-gray-500 block mt-0.5">Pay when you receive your items</span>
                      </div>
                      <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                        <Truck size={16} className="text-gray-600" />
                      </div>
                    </label>
                  )}
                </div>
              </div>
            )}

            {/* Pay in Installments Options */}
            {paymentTab === 'installments' && (
              <div className="space-y-3 animate-in fade-in">
                <p className="text-xs text-gray-500">Buy Now, Pay Later options:</p>
                <div className="grid grid-cols-1 gap-3">
                  {/* CredPal */}
                  {merchant?.feature_settings?.credpal_enabled === true && (
                    <label
                      className={`relative flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === 'credpal'
                        ? 'border-(--store-primary) bg-(--store-primary)/5'
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                        }`}
                    >
                      <input
                        type="radio"
                        name="payment"
                        value="credpal"
                        checked={paymentMethod === 'credpal'}
                        onChange={() => setPaymentMethod('credpal')}
                        className="sr-only"
                      />
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'credpal' ? 'border-(--store-primary)' : 'border-gray-400'}`}>
                        {paymentMethod === 'credpal' && <div className="w-2.5 h-2.5 rounded-full bg-(--store-primary)" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-gray-900">CredPal</span>
                          <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Salary earners only</span>
                        </div>
                        <span className="text-xs text-gray-500 block mt-0.5">Pay in 3-6 monthly installments</span>
                      </div>
                      <CredPalLogo className="w-6 h-6" />
                    </label>
                  )}

                  {/* Credit Direct */}
                  {merchant?.feature_settings?.credit_direct_enabled === true && (
                    <label
                      className={`relative flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === 'credit_direct'
                        ? 'border-(--store-primary) bg-(--store-primary)/5'
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                        }`}
                    >
                      <input
                        type="radio"
                        name="payment"
                        value="credit_direct"
                        checked={paymentMethod === 'credit_direct'}
                        onChange={() => setPaymentMethod('credit_direct')}
                        className="sr-only"
                      />
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'credit_direct' ? 'border-(--store-primary)' : 'border-gray-400'}`}>
                        {paymentMethod === 'credit_direct' && <div className="w-2.5 h-2.5 rounded-full bg-(--store-primary)" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-gray-900">Credit Direct</span>
                          <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">Salary & Business owners</span>
                        </div>
                        <span className="text-xs text-gray-500 block mt-0.5">Pay in 3-6 monthly installments</span>
                      </div>
                      <CreditDirectLogo className="w-6 h-6" />
                    </label>
                  )}
                </div>

                {/* CredPal Info */}
                {paymentMethod === 'credpal' && (
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 animate-in slide-in-from-top-2">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                        <CreditCard size={16} className="text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-gray-900">How CredPal works</h4>
                        <ul className="mt-2 space-y-1 text-xs text-gray-600">
                          <li>- Quick approval in minutes</li>
                          <li>- Pay over 3-6 months</li>
                          <li>- Competitive interest rates</li>
                          <li>- Receive your items immediately</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Credit Direct Info */}
                {paymentMethod === 'credit_direct' && (
                  <div className="p-4 bg-purple-50 rounded-xl border border-purple-100 animate-in slide-in-from-top-2">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center shrink-0">
                        <CreditCard size={16} className="text-purple-600" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-gray-900">How Credit Direct works</h4>
                        <ul className="mt-2 space-y-1 text-xs text-gray-600">
                          <li>- Instant approval decision</li>
                          <li>- Pay over 3-6 months</li>
                          <li>- No hidden fees</li>
                          <li>- Get your items immediately</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Show empty state if neither is enabled */}
                {(!merchant?.feature_settings?.credpal_enabled && !merchant?.feature_settings?.credit_direct_enabled) && (
                  <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <p className="text-sm text-gray-500">No installment options are currently available.</p>
                  </div>
                )}
              </div>
            )}
          </div>


          {/* Mobile/Inline Place Order Button for Payment Step */}
          <div className="pt-4 lg:hidden">
            {/* Newsletter Opt-in (Mobile) */}
            {!user && (
              <label className="flex items-start gap-3 cursor-pointer group mb-4 px-1">
                <div className="relative flex items-center pt-0.5">
                  <input
                    type="checkbox"
                    checked={newsletterOptIn}
                    onChange={(e) => setNewsletterOptIn(e.target.checked)}
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
                (remainingAmount > 0 && !hasAvailableSelectedPaymentMethod) ||
                (paymentMethod === 'payforme' && !isPayForMeValid)
              }
              className="w-full bg-(--store-primary) hover:bg-(--store-primary)/90 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-(--store-primary)/20 active:scale-[0.98]"
            >
              {isProcessing ? (
                <Loader2 className="animate-spin" size={20} />
              ) : paymentMethod === 'invoice' ? (
                'Generate Invoice'
              ) : paymentMethod === 'payforme' ? (
                'Send Payment Link'
              ) : (
                'Place Order'
              )}
              {!isProcessing && <ChevronRight size={20} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
