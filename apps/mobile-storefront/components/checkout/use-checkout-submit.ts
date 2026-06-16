import type { MutableRefObject } from 'react';
import type {
  PaymentMethodType,
  PaymentTab,
} from '@/components/checkout/PaymentMethodSelector';
import type {
  DeliveryMethod,
  ShippingQuote,
} from '@/components/checkout/types';
import type { MobileCheckoutIdempotencyState } from '@/lib/checkout-order-idempotency';
import type { ShippingAddressInput } from '@/lib/validation';
import {
  buildSavingsOrderFields,
  buildWalletOrderFields,
  getFullyPaidStoreCreditPaymentMethod,
  type SavingsSelection,
  type WalletSelection,
} from '@/lib/wallet-payment-helpers';
import { trackCheckoutStep } from '@/services/analytics';
import { createOrder } from '@/services/orders';
import { trackCheckoutRoutePurchaseCompleted } from '@/services/tiktok-checkout-route-tracking';
import { type CartItem, useCartStore } from '@/stores/cart-store';
import { submitBnplCheckout } from './checkout-bnpl-submit';
import {
  buildCheckoutOrderRequest,
  createCheckoutSnapshot,
} from './checkout-order-builders';
import { finalizeCheckoutPayment } from './checkout-payment-finalization';
import { runCheckoutPostOrderSideEffects } from './checkout-post-order-side-effects';
import type { PendingCryptoOrder } from './checkout-screen.constants';
import { resolveCheckoutStoreCreditSelections } from './checkout-store-credit';
import { handleCheckoutSubmitError } from './checkout-submit-error';
import { validateCheckoutSubmission } from './checkout-submit-validation';

interface CheckoutCustomer {
  email?: string | null;
  id?: string;
}

interface CheckoutUser {
  id?: string | null;
}

export interface UseCheckoutSubmitParams {
  accountPassword: string;
  appliedDiscountCode?: string | null;
  availablePaymentMethods: PaymentMethodType[];
  clearCart: () => void;
  currentShippingQuoteContextKey: string;
  customer: CheckoutCustomer | null | undefined;
  deliveryFee: number;
  deliveryMethod: DeliveryMethod;
  getLiveSavingsSelection: (input: {
    isStoreCreditCompatible: boolean;
    items: CartItem[];
    orderTotal: number;
  }) => SavingsSelection | undefined;
  getShippingProvider: () => string | undefined;
  isAuthenticated: boolean;
  isLoadingQuotes: boolean;
  isOrderInFlight: MutableRefObject<boolean>;
  isProcessing: boolean;
  mobileCheckoutIdempotencyRef: MutableRefObject<MobileCheckoutIdempotencyState | null>;
  orderTotals: { taxAmount: number } | null;
  paymentSettings: Parameters<typeof submitBnplCheckout>[0]['paymentSettings'];
  paymentTab: PaymentTab;
  resolvedShippingQuoteContextKey: string;
  saveAsDefaultAddress: boolean;
  saveDetails: boolean;
  selectedPayment: PaymentMethodType;
  selectedQuote: ShippingQuote | undefined;
  selectedSavedAddressId: string | null;
  setIsProcessing: (value: boolean) => void;
  setPendingOrder: (value: PendingCryptoOrder | null) => void;
  setShowCryptoSelection: (value: boolean) => void;
  setStep: (step: 'address' | 'payment' | 'review') => void;
  user: CheckoutUser | null | undefined;
  walletBalance: number;
  walletFundedBankTransferOptionEnabled: boolean;
  walletSelection: WalletSelection | undefined;
}

export function useCheckoutSubmit({
  accountPassword,
  appliedDiscountCode,
  availablePaymentMethods,
  clearCart,
  currentShippingQuoteContextKey,
  customer,
  deliveryFee,
  deliveryMethod,
  getLiveSavingsSelection,
  getShippingProvider,
  isAuthenticated,
  isLoadingQuotes,
  isOrderInFlight,
  isProcessing,
  mobileCheckoutIdempotencyRef,
  orderTotals,
  paymentSettings,
  paymentTab,
  resolvedShippingQuoteContextKey,
  saveAsDefaultAddress,
  saveDetails,
  selectedPayment,
  selectedQuote,
  selectedSavedAddressId,
  setIsProcessing,
  setPendingOrder,
  setShowCryptoSelection,
  setStep,
  user,
  walletBalance,
  walletFundedBankTransferOptionEnabled,
  walletSelection,
}: UseCheckoutSubmitParams) {
  return async (address: ShippingAddressInput) => {
    const itemsSnapshot = [...useCartStore.getState().items];

    if (
      !validateCheckoutSubmission({
        availablePaymentMethods,
        currentShippingQuoteContextKey,
        deliveryMethod,
        isLoadingQuotes,
        isOrderInFlight,
        isProcessing,
        itemsLength: itemsSnapshot.length,
        resolvedShippingQuoteContextKey,
        selectedPayment,
        selectedQuote,
        setStep,
      })
    ) {
      return;
    }

    isOrderInFlight.current = true;
    setIsProcessing(true);
    const cartSnapshot = [...itemsSnapshot];
    const snapshot = createCheckoutSnapshot(
      itemsSnapshot,
      deliveryFee,
      orderTotals?.taxAmount ?? 0
    );
    const { liveSavingsSelection, liveWalletSelection } =
      resolveCheckoutStoreCreditSelections({
        getLiveSavingsSelection,
        itemsSnapshot,
        paymentTab,
        selectedPayment,
        snapshotTotal: snapshot.total,
        walletBalance,
        walletSelection,
      });

    try {
      trackCheckoutStep('review');
      const customerEmail = customer?.email || address.email;
      const customerPhone = address.phone;
      const customerName = `${address.firstName} ${address.lastName}`;
      const paymentMethodForOrder =
        selectedPayment === 'payforme' ? 'invoice' : selectedPayment;
      const isBNPL =
        selectedPayment === 'credpal' ||
        selectedPayment === 'credit_direct' ||
        selectedPayment === 'klump';

      if (isBNPL) {
        await submitBnplCheckout({
          address,
          appliedDiscountCode,
          customerEmail,
          customerName,
          customerPhone,
          deliveryMethod,
          getShippingProvider,
          isOrderInFlight,
          itemsSnapshot,
          liveSavingsSelection,
          liveWalletSelection,
          mobileCheckoutIdempotencyRef,
          paymentMethodForOrder,
          paymentSettings,
          selectedPayment,
          selectedQuote,
          setIsProcessing,
          snapshot,
        });
        return;
      }

      const orderResponse = await createOrder({
        ...buildCheckoutOrderRequest({
          address,
          customerEmail,
          customerName,
          customerPhone,
          deliveryMethod,
          discountCode: appliedDiscountCode,
          itemsSnapshot,
          paymentMethodForOrder,
          selectedQuote,
          shippingProvider: getShippingProvider(),
          snapshot,
        }),
        // Discount codes and savings credit are mutually exclusive (the route
        // dispatches a single wrapper RPC). Wallet credit still stacks.
        ...(appliedDiscountCode
          ? {}
          : buildSavingsOrderFields(liveSavingsSelection)),
        ...buildWalletOrderFields(liveWalletSelection),
      });
      const { order } = orderResponse;
      const orderNumber =
        order.order_number || order.id.slice(0, 8).toUpperCase();
      const completedPaymentMethod =
        getFullyPaidStoreCreditPaymentMethod(orderResponse) ?? selectedPayment;

      void trackCheckoutRoutePurchaseCompleted({
        customerEmail,
        customerPhone,
        items: itemsSnapshot,
        orderId: order.id,
        orderNumber,
        paymentMethod: completedPaymentMethod,
        shipping: snapshot.deliveryFee,
        subtotal: snapshot.subtotal,
        tax: snapshot.taxAmount,
        total: order.total,
        userId: user?.id ?? undefined,
      });

      await finalizeCheckoutPayment({
        clearCart,
        customerEmail,
        customerName,
        customerPhone,
        isOrderInFlight,
        orderNumber,
        orderResponse,
        runPostOrderSideEffects: () => {
          void runCheckoutPostOrderSideEffects({
            accountPassword,
            address,
            customerEmail,
            customerId: customer?.id,
            isAuthenticated,
            saveAsDefaultAddress,
            saveDetails,
            selectedSavedAddressId,
          });
        },
        selectedPayment,
        setIsProcessing,
        setPendingOrder,
        setShowCryptoSelection,
        shouldCreateWalletFundedBankTransferOrder:
          walletFundedBankTransferOptionEnabled &&
          selectedPayment === 'bank_transfer',
      });
    } catch (error) {
      if (useCartStore.getState().items.length === 0) {
        useCartStore.getState().restoreItems(cartSnapshot);
      }
      handleCheckoutSubmitError(error, selectedPayment);
    } finally {
      setIsProcessing(false);
      isOrderInFlight.current = false;
    }
  };
}
