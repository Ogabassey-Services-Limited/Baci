import { Truck } from 'lucide-react';
import {
  BankTransferLogo,
  CredPalLogo,
  CreditDirectLogo,
  JuicywayLogo,
  KorapayLogo,
  PaystackLogo,
} from '../../../components/PaymentLogos';
import type { PaymentMethod, PaymentTab } from '../types';
import { InstallmentInfo, PaymentOptionCard } from './PaymentOptionCard';
import {
  type FeatureSettings,
  isNgnChargeCurrency,
} from './payment-step-availability';

interface PaymentOptionsPanelProps {
  paymentTab: PaymentTab;
  setPaymentTab: (v: PaymentTab) => void;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (v: PaymentMethod) => void;
  paystackCheckoutAvailable: boolean;
  korapayCheckoutAvailable: boolean;
  bankTransferCheckoutAvailable: boolean;
  featureSettings?: FeatureSettings | null;
  klumpEligible: boolean;
  hasInstallmentOptions: boolean;
  currency?: string | null;
}

export function PaymentOptionsPanel({
  paymentTab,
  setPaymentTab,
  paymentMethod,
  setPaymentMethod,
  paystackCheckoutAvailable,
  korapayCheckoutAvailable,
  bankTransferCheckoutAvailable,
  featureSettings,
  klumpEligible,
  hasInstallmentOptions,
  currency,
}: PaymentOptionsPanelProps) {
  const selectPaymentTab = (nextTab: PaymentTab) => {
    setPaymentTab(nextTab);
    setPaymentMethod('');
  };
  // Juicyway, CredPal, and Credit Direct can only ever charge NGN (see
  // resolveChargeCurrency), so their feature flags alone must not surface
  // them on a non-NGN checkout. Klump is already currency-gated upstream
  // via `klumpEligible` (isKlumpEligible).
  const ngnOnlyRailsAvailable = isNgnChargeCurrency(currency);

  return (
    <>
      <div className="flex p-1 bg-gray-100 rounded-xl">
        <button
          type="button"
          onClick={() => selectPaymentTab('full')}
          className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-bold transition-all ${
            paymentTab === 'full'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          Pay in Full
        </button>
        <button
          type="button"
          onClick={() => selectPaymentTab('installments')}
          className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-bold transition-all ${
            paymentTab === 'installments'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          Pay in Installments
        </button>
      </div>

      {paymentTab === 'full' && (
        <div className="space-y-3 animate-in fade-in">
          <p className="text-xs text-gray-500">Select a payment gateway:</p>
          <div className="grid grid-cols-1 gap-3">
            {paystackCheckoutAvailable && (
              <PaymentOptionCard
                method="paystack"
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                title="Paystack"
                description="Card, Bank Transfer, USSD"
                badge={{ label: 'Popular', className: 'bg-green-100 text-green-700' }}
                icon={<PaystackLogo className="size-6" />}
              />
            )}
            {bankTransferCheckoutAvailable && (
              <PaymentOptionCard
                method="bank_transfer"
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                title="Bank Transfer"
                description="Pay to a unique virtual account"
                badge={{ label: 'Automatic', className: 'bg-blue-100 text-blue-700' }}
                icon={<BankTransferLogo className="size-6" />}
              />
            )}
            {korapayCheckoutAvailable && (
              <PaymentOptionCard
                method="korapay"
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                title="Korapay"
                description="Card payments across Africa"
                icon={<KorapayLogo className="size-6" />}
              />
            )}
            {featureSettings?.juicyway_enabled === true &&
              ngnOnlyRailsAvailable && (
              <PaymentOptionCard
                method="juicyway"
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                title="Juicyway"
                description="USDT, USDC etc"
                badge={{ label: 'Crypto', className: 'bg-purple-100 text-purple-700' }}
                icon={<JuicywayLogo className="size-6" />}
              />
            )}
            {featureSettings?.pay_on_delivery_enabled === true && (
              <PaymentOptionCard
                method="pod"
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                title="Pay on Delivery"
                description="Pay when you receive your items"
                icon={
                  <div className="size-8 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Truck size={16} className="text-gray-600" />
                  </div>
                }
              />
            )}
          </div>
        </div>
      )}

      {paymentTab === 'installments' && (
        <div className="space-y-3 animate-in fade-in">
          <p className="text-xs text-gray-500">Buy Now, Pay Later options:</p>
          <div className="grid grid-cols-1 gap-3">
            {featureSettings?.credpal_enabled === true &&
              ngnOnlyRailsAvailable && (
              <PaymentOptionCard
                method="credpal"
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                title="CredPal"
                description="Pay in 3-6 monthly installments"
                badge={{
                  label: 'Salary earners only',
                  className: 'bg-green-100 text-green-700',
                }}
                icon={<CredPalLogo className="size-6" />}
              />
            )}
            {featureSettings?.credit_direct_enabled === true &&
              ngnOnlyRailsAvailable && (
              <PaymentOptionCard
                method="credit_direct"
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                title="Credit Direct"
                description="Pay in 3-6 monthly installments"
                badge={{
                  label: 'Salary & Business owners',
                  className: 'bg-purple-100 text-purple-700',
                }}
                icon={<CreditDirectLogo className="size-6" />}
              />
            )}
            {klumpEligible && (
              <PaymentOptionCard
                method="klump"
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                title="Klump"
                description="Split payment at checkout"
                badge={{
                  label: 'Buy now, pay later',
                  className: 'bg-store-primary/10 text-store-primary',
                }}
                icon={
                  <div className="size-8 bg-store-primary/5 rounded-lg flex items-center justify-center text-xs font-black text-store-primary">
                    K
                  </div>
                }
              />
            )}
          </div>

          {paymentMethod === 'credpal' && (
            <InstallmentInfo
              title="How CredPal works"
              tone="blue"
              items={[
                'Quick approval in minutes',
                'Pay over 3-6 months',
                'Competitive interest rates',
                'Receive your items immediately',
              ]}
            />
          )}
          {paymentMethod === 'credit_direct' && (
            <InstallmentInfo
              title="How Credit Direct works"
              tone="purple"
              items={[
                'Instant approval decision',
                'Pay over 3-6 months',
                'No hidden fees',
                'Get your items immediately',
              ]}
            />
          )}
          {paymentMethod === 'klump' && (
            <InstallmentInfo
              title="How Klump works"
              tone="primary"
              items={[
                'Choose Klump at checkout',
                'Complete approval securely',
                'Split payment over time',
                'Get your items immediately',
              ]}
            />
          )}
          {!hasInstallmentOptions && (
            <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-300">
              <p className="text-sm text-gray-500">
                No installment options are currently available.
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
