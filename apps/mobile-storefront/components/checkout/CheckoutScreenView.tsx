import { Stack } from 'expo-router';
import React, { useRef } from 'react';
import { Platform } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  type CheckoutStep,
  CheckoutStepper,
} from '@/components/checkout/CheckoutStepper';
import { CryptoSelectionModal } from '@/components/checkout/CryptoSelectionModal';
import { CheckoutCryptoPaymentModal } from '@/components/checkout/CheckoutCryptoPaymentModal';
import { CheckoutHeader } from '@/components/checkout/CheckoutHeader';
import { CheckoutLocationPickers } from '@/components/checkout/CheckoutLocationPickers';
import { CheckoutStepContent } from '@/components/checkout/CheckoutStepContent';
import { CheckoutBottomAction } from '@/components/checkout/CheckoutBottomAction';
import AppKeyboardContainer from '@/components/ui/AppKeyboardContainer';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useAuthStatus } from '@/hooks/use-auth-guard';
import type { MobileCheckoutIdempotencyState } from '@/lib/checkout-order-idempotency';
import { useCartStore } from '@/stores/cart-store';
import { checkoutScreenViewStyles as styles } from './CheckoutScreenView.styles';
import { useCheckoutAddressState } from './use-checkout-address-state';
import { useCheckoutCtaAnimation } from './use-checkout-cta-animation';
import { useCheckoutCryptoPayment } from './use-checkout-crypto-payment';
import { useCheckoutNavigation } from './use-checkout-navigation';
import { useCheckoutPaymentController } from './use-checkout-payment-controller';
import { useCheckoutStepActions } from './use-checkout-step-actions';
import { calculateCheckoutAssuranceFee } from './checkout-order-builders';
import {
  CHECKOUT_MERCHANT_ID,
  CHECKOUT_MERCHANT_SLUG,
} from './checkout-screen.constants';

export function CheckoutScreenView() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = (colorScheme ?? 'light') === 'dark';
  const insets = useSafeAreaInsets();

  const items = useCartStore((state) => state.items);
  const subtotal = useCartStore((state) => state.subtotal());
  const clearCart = useCartStore((state) => state.clearCart);
  const { customer, isAuthenticated, user } = useAuthStatus();

  const [step, setStep] = React.useState<CheckoutStep>('address');
  const [isProcessing, setIsProcessing] = React.useState(false);
  const isOrderInFlight = useRef(false);
  const mobileCheckoutIdempotencyRef =
    useRef<MobileCheckoutIdempotencyState | null>(null);
  const animatedCtaArrowStyle = useCheckoutCtaAnimation(isProcessing);

  const addressState = useCheckoutAddressState({
    customer,
    isAuthenticated,
    items,
    subtotal,
    user,
  });
  const {
    accountPassword,
    form,
    saveDetails,
    savedAddresses: savedAddressState,
    shipping,
    watchedCity,
    watchedState,
  } = addressState;
  const { handleSubmit, setValue } = form;
  const {
    citySearch,
    citySearchFocused,
    currentShippingQuoteContextKey,
    deliveryFee,
    deliveryMethod,
    handleSelectCity,
    handleSelectState,
    isLoadingQuotes,
    resolvedShippingQuoteContextKey,
    selectedQuote,
    setCitySearch,
    setCitySearchFocused,
    setShowCityPicker,
    setShowStatePicker,
    shippingCities,
    shippingStates,
    showCityPicker,
    showStatePicker,
  } = shipping;
  const formContentPaddingBottom = 116 + insets.bottom;
  const {
    saveAsDefaultAddress,
    selectedSavedAddressId,
    setIsContactCollapsed,
    setIsDeliveryCollapsed,
  } = savedAddressState;

  const { handleBack } = useCheckoutNavigation({
    isOrderInFlight,
    setStep,
    step,
  });

  const assuranceFee = calculateCheckoutAssuranceFee(items);

  const paymentController = useCheckoutPaymentController({
    assuranceFee,
    customerId: customer?.id,
    customerPhone: customer?.phone,
    deliveryFee,
    isAuthenticated,
    items,
    merchantId: CHECKOUT_MERCHANT_ID,
    merchantSlug: CHECKOUT_MERCHANT_SLUG,
    step,
    subtotal,
  });
  const {
    availablePaymentMethods,
    displayTotal,
    orderTotals,
    paymentSettings,
    paymentTab,
    savings,
    selectedPayment,
    total,
    walletBalance,
    walletSelection,
  } = paymentController;
  const { getLiveSavingsSelection } = savings;
  const {
    cryptoPayment,
    handleCryptoConfirm,
    setCryptoPayment,
    setPendingOrder,
    setShowCryptoSelection,
    showCryptoSelection,
  } = useCheckoutCryptoPayment({
    isOrderInFlight,
    setIsProcessing,
    total,
  });

  const { handleContinue, handlePlaceOrder } = useCheckoutStepActions({
    accountPassword,
    availablePaymentMethods,
    clearCart,
    currentShippingQuoteContextKey,
    customer,
    deliveryFee,
    deliveryMethod,
    getLiveSavingsSelection,
    getShippingProvider: shipping.getShippingProvider,
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
    walletFundedBankTransferOptionEnabled:
      paymentController.walletFundedBankTransferOptionEnabled,
    walletSelection,
    handleSubmit,
    setIsContactCollapsed,
    setIsDeliveryCollapsed,
    setValue,
    step,
  });

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['top', 'left', 'right']}
      >
        <CheckoutHeader colors={colors} onBack={handleBack} />

        <AppKeyboardContainer
          style={[styles.contentShell, { backgroundColor: colors.muted }]}
        >
          <CheckoutStepper
            step={step}
            setStep={setStep}
            itemCount={items.reduce((acc, item) => acc + item.quantity, 0)}
            colors={colors}
            isDark={isDark}
          />

          <CheckoutStepContent
            addressState={addressState}
            assuranceFee={assuranceFee}
            colors={colors}
            formContentPaddingBottom={formContentPaddingBottom}
            isAuthenticated={isAuthenticated}
            isDark={isDark}
            items={items}
            paymentController={paymentController}
            setStep={setStep}
            step={step}
            subtotal={subtotal}
          />

          <CheckoutBottomAction
            animatedCtaArrowStyle={animatedCtaArrowStyle}
            colors={colors}
            displayTotal={displayTotal}
            insetsBottom={insets.bottom}
            isProcessing={isProcessing}
            itemCount={items.length}
            onContinue={handleContinue}
            onPlaceOrder={handlePlaceOrder}
            selectedPayment={selectedPayment}
            step={step}
            total={total}
          />
        </AppKeyboardContainer>
      </SafeAreaView>

      <CheckoutLocationPickers
        citySearch={citySearch}
        citySearchFocused={citySearchFocused}
        colors={colors}
        isDark={isDark}
        onChangeCitySearch={setCitySearch}
        onCloseCityPicker={() => {
          setShowCityPicker(false);
          setCitySearch('');
        }}
        onCloseStatePicker={() => setShowStatePicker(false)}
        onSelectCity={handleSelectCity}
        onSelectState={handleSelectState}
        onSetCitySearchFocused={setCitySearchFocused}
        removeClippedSubviews={Platform.OS === 'android'}
        shippingCities={shippingCities}
        shippingStates={shippingStates}
        showCityPicker={showCityPicker}
        showStatePicker={showStatePicker}
        watchedCity={watchedCity}
        watchedState={watchedState}
      />

      <CryptoSelectionModal
        visible={showCryptoSelection}
        onClose={() => setShowCryptoSelection(false)}
        onConfirm={(chain, currency) => {
          // Cast string types to strict union types is handled by internal logic or just pass string if API accepts string
          handleCryptoConfirm(chain, currency);
        }}
        isProcessing={isProcessing}
      />

      <CheckoutCryptoPaymentModal
        clearCart={clearCart}
        colors={colors}
        cryptoPayment={cryptoPayment}
        onChangeSelection={() => {
          setCryptoPayment(null);
          setShowCryptoSelection(true);
        }}
        onClosePayment={() => setCryptoPayment(null)}
      />
    </>
  );
}
