import { useEffect, useState } from 'react';
import type { CheckoutStep } from '@/components/checkout/CheckoutStepper';
import {
  getPaymentTabForMethod,
} from '@/components/checkout/checkout-step-helpers';
import {
  type PaymentMethodType,
  type PaymentTab,
} from '@/components/checkout/PaymentMethodSelector';
import { useCheckoutSavings } from '@/hooks/use-checkout-savings';
import { useWallet } from '@/hooks/use-wallet';
import {
  getEnabledPaymentMethods,
  getMerchantTaxRate,
  useMerchantPaymentSettings,
} from '@/hooks/useMerchantPaymentSettings';
import { getKlumpDisabledReason } from '@/lib/klump-checkout';
import { isStoreCreditCompatiblePayment } from '@/lib/store-credit-compatible-payment';
import { calculateCommerce } from '@/lib/supabase';
import type { WalletSelection } from '@/lib/wallet-payment-helpers';
import type { useCartStore } from '@/stores/cart-store';

type CartItems = ReturnType<typeof useCartStore.getState>['items'];

interface UseCheckoutPaymentControllerParams {
  assuranceFee: number;
  customerId?: string;
  customerPhone?: string | null;
  deliveryFee: number;
  isAuthenticated: boolean;
  items: CartItems;
  merchantId: string;
  merchantSlug: string;
  step: CheckoutStep;
  subtotal: number;
}

export function useCheckoutPaymentController({
  assuranceFee,
  customerId,
  customerPhone,
  deliveryFee,
  isAuthenticated,
  items,
  merchantId,
  merchantSlug,
  step,
  subtotal,
}: UseCheckoutPaymentControllerParams) {
  const { data: paymentSettings } = useMerchantPaymentSettings();
  const enabledPaymentMethods = getEnabledPaymentMethods(paymentSettings);
  const walletOrderAutoDebitEnabled = Boolean(
    paymentSettings?.paystack_enabled &&
      paymentSettings.wallet_paystack_dva_enabled &&
      paymentSettings.wallet_order_auto_debit_enabled
  );
  const availablePaymentMethods: PaymentMethodType[] = Array.from(
    new Set<PaymentMethodType>([
      ...enabledPaymentMethods,
      'invoice',
      'payforme',
    ])
  );
  const [selectedPayment, setSelectedPayment] =
    useState<PaymentMethodType>('paystack');
  const [paymentTab, setPaymentTab] = useState<PaymentTab>('full');
  const [walletSelection, setWalletSelection] = useState<
    WalletSelection | undefined
  >(undefined);
  const [orderTotals, setOrderTotals] = useState<{
    total: number;
    taxAmount: number;
  } | null>(null);
  const savings = useCheckoutSavings({
    customerId,
    isAuthenticated,
    items,
    merchantId,
    merchantSlug,
  });
  const walletQuery = useWallet();
  const walletBalance = walletQuery.data?.wallet?.balance ?? 0;

  const handleSelectPaymentTab = (tab: PaymentTab) => {
    setPaymentTab(tab);
    const tabMethods = availablePaymentMethods.filter(
      (method) => getPaymentTabForMethod(method) === tab
    );
    if (tabMethods.length > 0) setSelectedPayment(tabMethods[0]);
  };

  useEffect(() => {
    const currentTabMethods = availablePaymentMethods.filter(
      (method) => getPaymentTabForMethod(method) === paymentTab
    );
    if (!availablePaymentMethods.includes(selectedPayment)) {
      const fallbackMethod =
        currentTabMethods[0] ?? availablePaymentMethods[0] ?? 'paystack';
      setSelectedPayment(fallbackMethod);
      setPaymentTab(getPaymentTabForMethod(fallbackMethod));
      return;
    }

    if (!currentTabMethods.includes(selectedPayment)) {
      const fallbackMethod = currentTabMethods[0];
      if (fallbackMethod) {
        setSelectedPayment(fallbackMethod);
        return;
      }

      const fallbackTab =
        (['full', 'installments', 'pay_later'] as const).find((tab) =>
          availablePaymentMethods.some(
            (method) => getPaymentTabForMethod(method) === tab
          )
        ) ?? 'full';
      setPaymentTab(fallbackTab);
      const nextMethod = availablePaymentMethods.find(
        (method) => getPaymentTabForMethod(method) === fallbackTab
      );
      if (nextMethod) setSelectedPayment(nextMethod);
    }
  }, [availablePaymentMethods, selectedPayment, paymentTab]);

  useEffect(() => {
    const fetchTotals = async () => {
      try {
        const taxRate = getMerchantTaxRate(paymentSettings);
        const result = await calculateCommerce('calculate_order', {
          subtotal,
          shippingFee: deliveryFee,
          taxRate,
          assuranceFee,
        });
        setOrderTotals(result);
      } catch {
        // Totals fall back to local arithmetic below.
      }
    };
    fetchTotals();
  }, [subtotal, deliveryFee, paymentSettings, assuranceFee]);

  const taxAmount = orderTotals?.taxAmount ?? 0;
  const total =
    orderTotals?.total ?? subtotal + deliveryFee + assuranceFee + taxAmount;
  const liveSavingsSelectionForWalletFundedBankTransfer =
    savings.getLiveSavingsSelection({
      isStoreCreditCompatible: true,
      items,
      orderTotal: total,
    });
  const walletFundedBankTransferResidual = Math.max(
    total - (liveSavingsSelectionForWalletFundedBankTransfer?.amount ?? 0),
    0
  );
  const walletFundedBankTransferOptionEnabled =
    isEligibleForWalletFundedBankTransfer({
      customerId,
      customerPhone,
      isAuthenticated,
      residualAfterSavings: walletFundedBankTransferResidual,
      walletBalance,
      walletOrderAutoDebitEnabled,
    });
  const storeCreditCompatible = isStoreCreditCompatiblePayment({
    paymentTab,
    selectedPayment,
  });
  const liveSavingsSelectionForKlumpGate = savings.getLiveSavingsSelection({
    isStoreCreditCompatible: storeCreditCompatible,
    items,
    orderTotal: total,
  });
  const walletResidualForKlumpGate = Math.max(
    total - (liveSavingsSelectionForKlumpGate?.amount ?? 0),
    0
  );
  const liveWalletSelectionForKlumpGate: WalletSelection | undefined =
    walletSelection?.use === true && storeCreditCompatible
      ? {
          use: true,
          amount: Math.max(0, Math.min(walletBalance, walletResidualForKlumpGate)),
        }
      : undefined;

  return {
    availablePaymentMethods,
    displayTotal: step === 'review' ? total : subtotal + deliveryFee + assuranceFee,
    handleSelectPaymentTab,
    klumpDisabledReason: getKlumpDisabledReason(
      paymentSettings,
      total,
      liveWalletSelectionForKlumpGate,
      liveSavingsSelectionForKlumpGate
    ),
    orderTotals,
    paymentSettings,
    paymentTab,
    savings,
    selectedPayment,
    setPaymentTab,
    setSelectedPayment,
    setWalletSelection,
    total,
    walletBalance,
    walletFundedBankTransferOptionEnabled,
    walletSelection,
  };
}

export type CheckoutPaymentController = ReturnType<
  typeof useCheckoutPaymentController
>;

function isEligibleForWalletFundedBankTransfer({
  customerId,
  customerPhone,
  isAuthenticated,
  residualAfterSavings,
  walletBalance,
  walletOrderAutoDebitEnabled,
}: {
  customerId?: string | null;
  customerPhone?: string | null;
  isAuthenticated: boolean;
  residualAfterSavings: number;
  walletBalance: number;
  walletOrderAutoDebitEnabled: boolean;
}) {
  return (
    walletOrderAutoDebitEnabled &&
    isAuthenticated &&
    Boolean(customerId) &&
    Boolean(customerPhone) &&
    residualAfterSavings > 0 &&
    walletBalance < residualAfterSavings
  );
}
