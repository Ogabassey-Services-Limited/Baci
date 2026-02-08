'use client';

import {
  AlertCircle,
  ChevronRight,
  Loader2,
  ShieldCheck,
  User,
} from 'lucide-react';
import { MobileOrderSummary } from '../components/MobileCheckoutComponents';
import { useRouter, useSearchParams } from 'next/navigation';
import type React from 'react';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useCart } from '@/hooks/use-cart';
import { useMerchantSafe } from '@/hooks/use-merchant';
import { usePersistedForm } from '@/hooks/use-persisted-state';
import { useAuthSafe } from '@/contexts/auth-context';
import { CheckoutAuthModal } from '@/components/storefront/checkout-auth-modal';
import { asRoute } from '@/lib/routes';
import { isValidPhoneNumber } from 'react-phone-number-input';
import { executeDirectPayment } from './checkout/handlers/direct-payment';
import { handlePlaceOrder as handlePlaceOrderFn } from './checkout/handlers/place-order';
import { CryptoSelectorModal } from './checkout/components/CryptoSelectorModal';
import { CryptoPaymentModal } from './checkout/components/CryptoPaymentModal';
import { DvaModal } from './checkout/components/DvaModal';
import { ContactStep } from './checkout/components/ContactStep';
import { DeliveryStep } from './checkout/components/DeliveryStep';
import { PaymentStep } from './checkout/components/PaymentStep';
import { OrderSummarySidebar } from './checkout/components/OrderSummarySidebar';

import type {
  SavedAddress,
  PaymentMethod,
  PaymentTab,
} from './checkout/types';
import {
  calculateDeliveryCost,
} from './checkout/utils';
import { useWallet } from './checkout/hooks/use-wallet';
import { useOrderTotals } from './checkout/hooks/use-order-totals';
import { useOrderResume } from './checkout/hooks/use-order-resume';
import { useShipping } from './checkout/hooks/use-shipping';
import { useDvaPayment } from './checkout/hooks/use-dva-payment';
import { useCryptoPayment } from './checkout/hooks/use-crypto-payment';

export const CheckoutPage: React.FC = () => {
  const { cart, cartTotal, clearCart, isHydrated } = useCart();
  const merchantContext = useMerchantSafe();
  const merchant = merchantContext?.merchant;
  const basePath = merchantContext?.basePath;
  const router = useRouter();

  const getHref = (path: string) =>
    path.startsWith('http') ? path : `${basePath || ''}${path === '/' ? '' : path}`;

  const searchParams = useSearchParams();
  const auth = useAuthSafe();
  const user = auth?.user;

  // Persisted checkout form state - survives hydration re-mounts and page refreshes
  // Using custom hook with debounced sessionStorage persistence (2025 best practice)
  const {
    values: checkoutForm,
    setValue: setCheckoutField,
    setValues: setCheckoutFields,
    clear: clearCheckoutSession,
  } = usePersistedForm('checkout-form', {
    firstName: '',
    lastName: '',
    customerEmail: '',
    customerPhone: '',
    newAddressStreet: '',
    newAddressState: '',
    newAddressCity: '',
    currentStep: 'contact' as 'contact' | 'delivery' | 'payment',
    completedSteps: { contact: false, delivery: false },
  });

  // Destructure for convenience (these are reactive)
  const {
    firstName,
    lastName,
    customerEmail,
    customerPhone,
    newAddressStreet,
    newAddressState,
    newAddressCity,
    currentStep: rawCurrentStep,
    completedSteps: rawCompletedSteps,
  } = checkoutForm;

  // Hydration safety: Force default state during server/first render to match server HTML
  const currentStep = isHydrated ? rawCurrentStep : 'contact';
  const completedSteps = isHydrated ? rawCompletedSteps : { contact: false, delivery: false };

  // Convenient setters that update the persisted form
  const setFirstName = useCallback((v: string) => setCheckoutField('firstName', v), [setCheckoutField]);
  const setLastName = useCallback((v: string) => setCheckoutField('lastName', v), [setCheckoutField]);
  const setCustomerEmail = useCallback((v: string) => setCheckoutField('customerEmail', v), [setCheckoutField]);
  const setCustomerPhone = useCallback((v: string) => setCheckoutField('customerPhone', v), [setCheckoutField]);
  const setNewAddressStreet = useCallback((v: string) => setCheckoutField('newAddressStreet', v), [setCheckoutField]);
  const setNewAddressState = useCallback((v: string) => setCheckoutField('newAddressState', v), [setCheckoutField]);
  const setNewAddressCity = useCallback((v: string) => setCheckoutField('newAddressCity', v), [setCheckoutField]);
  const setCurrentStep = useCallback((v: 'contact' | 'delivery' | 'payment') => setCheckoutField('currentStep', v), [setCheckoutField]);
  const setCompletedSteps = useCallback(
    (v: { contact: boolean; delivery: boolean } | ((prev: { contact: boolean; delivery: boolean }) => { contact: boolean; delivery: boolean })) => {
      if (typeof v === 'function') {
        setCheckoutField('completedSteps', v(completedSteps));
      } else {
        setCheckoutField('completedSteps', v);
      }
    },
    [setCheckoutField, completedSteps]
  );

  // Non-persisted UI state
  const [createAccount, setCreateAccount] = useState(false);
  const [accountPassword, setAccountPassword] = useState('');
  const [newsletterOptIn, setNewsletterOptIn] = useState(true);
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [contactValidationAttempted, setContactValidationAttempted] = useState(false);

  // Copy to clipboard helper (2025: Clipboard API with visual feedback)
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      // Auto-clear after 2 seconds
      setTimeout(() => setCopiedText(null), 2000);
    } catch (err) {
      // Clipboard API not supported - show error instead of using deprecated method
      console.error('Clipboard API not available:', err);
    }
  };

  // Validation States (hydration-safe: default to false during SSR to match disabled="" on server)
  const rawIsContactValid = useMemo(() => {
    const hasRequiredFields = firstName.trim() && lastName.trim() && customerEmail.trim() && customerPhone;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isPhoneValid = customerPhone && isValidPhoneNumber(customerPhone);
    return !!(hasRequiredFields && emailRegex.test(customerEmail.trim()) && isPhoneValid);
  }, [firstName, lastName, customerEmail, customerPhone]);
  const isContactValid = isHydrated ? rawIsContactValid : false;


  // Crypto payment (selection, initialization, verification, polling)
  const crypto = useCryptoPayment({
    merchantId: merchant?.id,
    clearCheckoutSession,
    clearCart,
    routerPush: (url: string) => router.push(asRoute(url)),
    getHref,
  });

  // DVA bank transfer
  const dva = useDvaPayment({
    merchantId: merchant?.id,
    customerEmail,
    customerPhone,
    firstName,
    lastName,
  });

  // Mobile app order resume
  const resumeOrderId = searchParams.get('orderId');
  const preferredGateway = searchParams.get('gateway') as 'credpal' | 'credit_direct' | null;
  const autoTriggerRef = useRef(false);
  const isOrderInFlightRef = useRef(false);

  // Retrieve gift data if passed from cart
  const giftWrappingCost = Number(searchParams.get('giftWrappingCost')) || 0;

  // Saved Addresses (Future integration: Fetch from API)
  const [addresses, _setAddresses] = useState<SavedAddress[]>([]); // Empty for now, forcing new address


  const [selectedAddressId, setSelectedAddressId] = useState<number>(0);
  const [isNewAddressMode, setIsNewAddressMode] = useState(true);
  const [deliveryMethod, setDeliveryMethod] = useState<
    'pickup' | 'door' | 'airport'
  >('door');
  const [airportType, setAirportType] = useState<'delivery' | 'pickup'>('delivery');

  // Shipping (locations, quotes, selection)
  const {
    shippingStates,
    shippingCities,
    isLoadingLocations,
    shippingQuotes,
    setShippingQuotes,
    isLoadingQuotes,
    selectedQuoteId,
    setSelectedQuoteId,
    fetchShippingQuotes,
  } = useShipping({
    deliveryMethod,
    isNewAddressMode,
    newAddressState,
    newAddressCity,
    newAddressStreet,
    customerPhone,
    firstName,
    lastName,
    customerEmail,
    selectedAddressId,
    addresses,
    cart,
  });

  // Delivery step validation (hydration-safe)
  const rawIsDeliveryValid = useMemo(() => {
    if (!deliveryMethod) return false;
    // For door delivery, a shipping quote MUST be selected
    if (deliveryMethod === 'door') return !!selectedQuoteId;
    // For airport, a type (pickup/delivery) must be selected
    if (deliveryMethod === 'airport') return !!airportType;
    // Pickup is valid as long as the state matches (handled by UI selection enforcement)
    return true;
  }, [deliveryMethod, selectedQuoteId, airportType]);
  const isDeliveryValid = isHydrated ? rawIsDeliveryValid : false;

  // Payment State
  const [paymentTab, setPaymentTab] = useState<PaymentTab>('full');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('');

  // Order resume from mobile app
  const { resumedOrder, isLoadingResumedOrder, resumeOrderError } = useOrderResume({
    resumeOrderId,
    preferredGateway,
    setCheckoutFields,
    setPaymentTab,
    setPaymentMethod,
  });

  const { walletBalance, walletLoading, payWithWallet, setPayWithWallet, setWalletBalance } = useWallet({
    userId: user?.id,
    merchantSlug: merchant?.slug,
  });
  const [isProcessing, setIsProcessing] = useState(false);

  // Note: currentStep and completedSteps are now part of checkoutForm (persisted)

  // Pay For Me State
  const [payForMeDetails, setPayForMeDetails] = useState({
    name: '',
    contact: '',
    note: '',
  });

  // Prefill user data if logged in
  useEffect(() => {
    if (user) {
      if (user.email && !customerEmail) setCustomerEmail(user.email);

      // Auto-fill name if not set
      if (!firstName && !lastName) {
        if (user.user_metadata?.first_name || user.user_metadata?.last_name) {
          setFirstName(user.user_metadata.first_name || '');
          setLastName(user.user_metadata.last_name || '');
        } else if (user.user_metadata?.full_name) {
          const parts = user.user_metadata.full_name.split(' ');
          setFirstName(parts[0] || '');
          setLastName(parts.slice(1).join(' ') || '');
        } else if (user.user_metadata?.name) {
          const parts = user.user_metadata.name.split(' ');
          setFirstName(parts[0] || '');
          setLastName(parts.slice(1).join(' ') || '');
        }
      }

      if (user.user_metadata?.phone && !customerPhone) {
        setCustomerPhone(user.user_metadata.phone);
      }
    }
  }, [user, customerEmail, firstName, lastName, customerPhone]);


  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const deliveryCost = calculateDeliveryCost(deliveryMethod, selectedQuoteId, shippingQuotes, airportType);

  const taxRate = merchant?.vat_registration_status === 'registered'
    ? (merchant.vat_rate ?? 7.5) / 100
    : 0;

  const orderTotals = useOrderTotals({ cartTotal, deliveryCost, taxRate });

  const total = orderTotals?.total || (cartTotal + deliveryCost + giftWrappingCost);

  // Wallet credit calculation (2025: can't redeem more than order total)
  const walletAmountUsed = payWithWallet ? Math.min(walletBalance, total) : 0;
  const remainingAmount = total - walletAmountUsed;

  // Direct payment for resumed orders (thin wrapper binding current state)
  const runDirectPayment = async () => {
    await executeDirectPayment({
      resumedOrder,
      preferredGateway,
      merchantSlug: merchant?.slug || '',
      setIsProcessing,
      clearCheckoutSession,
      routerPush: (url: string) => router.push(asRoute(url)),
      getHref,
    });
  };

  // Auto-trigger payment for resumed orders
  useEffect(() => {
    if (resumedOrder && preferredGateway && !autoTriggerRef.current && !isProcessing) {
      autoTriggerRef.current = true;
      runDirectPayment();
    }
  }, [resumedOrder, preferredGateway]);

  // Place order (thin wrapper binding current state to extracted handler)
  const handlePlaceOrder = async () => {
    await handlePlaceOrderFn({
      merchant: merchant ? { id: merchant.id, slug: merchant.slug || '' } : null,
      customerEmail,
      firstName,
      lastName,
      customerPhone,
      deliveryMethod,
      isNewAddressMode,
      newAddressStreet,
      newAddressCity,
      newAddressState,
      selectedAddressId,
      addresses,
      airportType,
      cart,
      cartTotal,
      deliveryCost,
      total,
      selectedQuoteId,
      shippingQuotes,
      paymentMethod,
      payWithWallet,
      walletAmountUsed,
      createAccount,
      accountPassword,
      newsletterOptIn,
      user: user ? { id: user.id } : null,
      payForMeDetails,
      resumedOrder,
      preferredGateway,
      isOrderInFlightRef,
      setIsProcessing,
      setWalletBalance,
      setCurrentStep,
      setCompletedSteps,
      clearCheckoutSession,
      clearCart,
      routerPush: (url: string) => router.push(asRoute(url)),
      getHref,
      executeDirectPayment: runDirectPayment,
      crypto: {
        setPendingCryptoOrder: crypto.setPendingCryptoOrder,
        setShowCryptoSelector: crypto.setShowCryptoSelector,
        setCryptoPaymentData: crypto.setCryptoPaymentData,
      },
      dva: {
        handleBankTransfer: dva.handleBankTransfer,
      },
    });
  };

  // Unified Next Step Handler for Mobile Action Bar
  const handleNextStep = () => {
    if (currentStep === 'contact') {
      // Validation Logic (Same as desktop button)
      setContactValidationAttempted(true);

      const trimmedFirstName = firstName.trim();
      const trimmedLastName = lastName.trim();
      const trimmedEmail = customerEmail.trim();

      // Validate all required fields
      const hasErrors = !trimmedFirstName || !trimmedLastName || !trimmedEmail || !customerPhone || !isValidPhoneNumber(customerPhone);

      if (hasErrors) return; // Inline errors will show

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) return;

      setCompletedSteps(prev => ({ ...prev, contact: true }));
      setCurrentStep('delivery');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (currentStep === 'delivery') {
      setCompletedSteps(prev => ({ ...prev, delivery: true }));
      setCurrentStep('payment');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (currentStep === 'payment') {
      handlePlaceOrder();
    }
  };

  const isPayForMeValid =
    paymentMethod === 'payforme'
      ? !!(payForMeDetails.name && payForMeDetails.contact)
      : true;

  // Loading state (Initial fetch OR waiting for auto-trigger)
  // This prevents the form from flashing briefly before the payment widget opens
  const isAutoTriggerProcessing = resumedOrder && !!preferredGateway && !isProcessing;

  if (isLoadingResumedOrder || isAutoTriggerProcessing) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex items-center justify-center pb-20">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-[var(--store-primary)]" />
          <p className="text-gray-500 font-medium animate-pulse">
            {isLoadingResumedOrder ? 'Loading order...' : 'Initializing secure checkout...'}
          </p>
        </div>
      </div>
    );
  }

  // Error state for order resumption
  if (resumeOrderId && resumeOrderError) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex items-center justify-center pb-20">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Something Went Wrong</h1>
          <p className="text-gray-500 mb-6">{resumeOrderError}</p>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[var(--store-primary)] text-white font-semibold rounded-xl hover:bg-[var(--store-primary)]/90 transition-colors"
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={() => router.push(asRoute(getHref('/')))}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
            >
              Go to Homepage
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-6">
            If this problem persists, please{' '}
            <button
              type="button"
              onClick={() => router.push(asRoute(getHref('/contact')))}
              className="text-[var(--store-primary)] underline"
            >
              contact support
            </button>
            .
          </p>
        </div>
      </div>
    );
  }

  // Empty cart check - only show after hydration confirms cart is genuinely empty
  // Skip this check when resuming an order (cart is empty during order resumption)





  return (
    <div className="min-h-screen bg-gray-50/50 pb-20 flex flex-col">
      {/* Checkout Navbar */}
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-200/50 shadow-sm supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button
            onClick={() => router.push(asRoute(getHref('/cart')))}
            className="group flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-[var(--store-primary)] transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-[var(--store-primary)]/5 transition-colors">
              <ChevronRight className="w-4 h-4 rotate-180 group-hover:text-[var(--store-primary)] transition-colors" />
            </div>
            <span className="hidden sm:inline">Return to Cart</span>
          </button>

          <div className="flex flex-col items-center">
            <div className="font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-green-600" />
              <span>Secure Checkout</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-100">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Encrypted
            </div>
          </div>
        </div>
      </div>
      <CheckoutAuthModal
        isOpen={isAuthModalOpen}
        onOpenChange={setIsAuthModalOpen}
        onSuccess={() => setIsAuthModalOpen(false)}
      />

      {/* Crypto Selector Modal */}
      {crypto.showCryptoSelector && (
        <CryptoSelectorModal
          selectedCryptoCurrency={crypto.selectedCryptoCurrency}
          selectedCryptoChain={crypto.selectedCryptoChain}
          isInitializingCrypto={crypto.isInitializingCrypto}
          onCurrencyChange={crypto.handleCryptoCurrencyChange}
          onChainChange={crypto.setSelectedCryptoChain}
          onInitialize={crypto.initializeCryptoPayment}
          onClose={() => {
            crypto.setShowCryptoSelector(false);
            crypto.setPendingCryptoOrder(null);
            isOrderInFlightRef.current = false;
          }}
        />
      )}

      {/* Crypto Payment Modal */}
      {crypto.cryptoPaymentData && (
        <CryptoPaymentModal
          data={crypto.cryptoPaymentData}
          verificationStatus={crypto.cryptoVerificationStatus}
          isVerifying={crypto.isVerifyingCrypto}
          copiedText={copiedText}
          onVerify={crypto.verifyCryptoPayment}
          onCopyToClipboard={copyToClipboard}
          onClose={() => {
            crypto.setCryptoPaymentData(null);
            crypto.setCryptoVerificationStatus('idle');
            crypto.setIsVerifyingCrypto(false);
          }}
          onCloseConfirm={() => {
            const confirmed = confirm(
              'Are you sure you want to close? If you\'ve already sent payment, your order will still be processed once the payment is detected.'
            );
            if (confirmed) {
              crypto.setCryptoPaymentData(null);
              crypto.setCryptoVerificationStatus('idle');
            }
          }}
        />
      )}

      {/* DVA Bank Transfer Modal */}
      {dva.dvaData && (
        <DvaModal
          data={dva.dvaData}
          copiedText={copiedText}
          onCopyToClipboard={copyToClipboard}
          onClose={() => dva.setDvaData(null)}
        />
      )}

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-3">
            <span className="w-10 h-10 bg-[var(--store-primary)] text-white rounded-xl flex items-center justify-center shadow-[var(--store-primary)]/20 shadow-lg">
              <ShieldCheck size={20} />
            </span>
            Secure Checkout
          </h1>
          <div className="flex items-center gap-2 text-sm text-gray-500 bg-white px-3 py-1.5 rounded-full border border-gray-100 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            SSL Encrypted
          </div>
        </div>

        {/* MOBILE ORDER SUMMARY (Collapsible) */}
        {/* MOBILE ORDER SUMMARY (Collapsible) */}
        <MobileOrderSummary
          cart={cart.length > 0 ? cart : (resumedOrder?.items as any[]) || []}
          cartTotal={cartTotal > 0 ? cartTotal : resumedOrder?.subtotal || 0}
          deliveryCost={deliveryCost || resumedOrder?.shipping_cost || 0}
          deliveryMethod={deliveryMethod as any}
          giftWrappingCost={giftWrappingCost}
          walletBalance={walletBalance}
          payWithWallet={payWithWallet}
          walletAmountUsed={walletAmountUsed}
          remainingAmount={remainingAmount > 0 ? remainingAmount : resumedOrder?.total || remainingAmount}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* LEFT COLUMN: Accordion Steps */}
          <div className="lg:col-span-8 space-y-6">

            {/* Auth Banner for Guests (2026 Best Practice) */}
            {!user && currentStep === 'contact' && (
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-500">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                    <User size={20} className="text-blue-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">Already have an account?</h4>
                    <p className="text-xs text-gray-500">Sign in to use your saved addresses and track orders.</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="px-4 py-2 bg-white text-blue-600 font-bold text-xs rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors shadow-sm active:scale-95"
                >
                  Sign In
                </button>
              </div>
            )}

            {/* Step 1: Contact Information */}
            <ContactStep
              currentStep={currentStep}
              completedSteps={completedSteps}
              firstName={firstName}
              lastName={lastName}
              customerEmail={customerEmail}
              customerPhone={customerPhone}
              setFirstName={setFirstName}
              setLastName={setLastName}
              setCustomerEmail={setCustomerEmail}
              setCustomerPhone={setCustomerPhone}
              contactValidationAttempted={contactValidationAttempted}
              isContactValid={isContactValid}
              user={user}
              createAccount={createAccount}
              setCreateAccount={setCreateAccount}
              accountPassword={accountPassword}
              setAccountPassword={setAccountPassword}
              showPasswordInput={showPasswordInput}
              setShowPasswordInput={setShowPasswordInput}
              isPasswordVisible={isPasswordVisible}
              setIsPasswordVisible={setIsPasswordVisible}
              setCurrentStep={setCurrentStep}
              setCompletedSteps={setCompletedSteps}
            />

            {/* Step 2: Delivery Method */}
            <DeliveryStep
              currentStep={currentStep}
              completedSteps={completedSteps}
              deliveryMethod={deliveryMethod}
              setDeliveryMethod={setDeliveryMethod}
              airportType={airportType}
              setAirportType={setAirportType}
              isNewAddressMode={isNewAddressMode}
              setIsNewAddressMode={setIsNewAddressMode}
              newAddressStreet={newAddressStreet}
              newAddressState={newAddressState}
              newAddressCity={newAddressCity}
              setNewAddressStreet={setNewAddressStreet}
              setNewAddressState={setNewAddressState}
              setNewAddressCity={setNewAddressCity}
              selectedAddressId={selectedAddressId}
              setSelectedAddressId={setSelectedAddressId}
              addresses={addresses}
              shippingStates={shippingStates}
              shippingCities={shippingCities}
              isLoadingLocations={isLoadingLocations}
              shippingQuotes={shippingQuotes}
              setShippingQuotes={setShippingQuotes}
              isLoadingQuotes={isLoadingQuotes}
              selectedQuoteId={selectedQuoteId}
              setSelectedQuoteId={setSelectedQuoteId}
              fetchShippingQuotes={fetchShippingQuotes}
              isDeliveryValid={isDeliveryValid}
              setCurrentStep={setCurrentStep}
              setCompletedSteps={setCompletedSteps}
              user={user}
              isHydrated={isHydrated}
              customerPhone={customerPhone}
              firstName={firstName}
              lastName={lastName}
              customerEmail={customerEmail}
            />

            {/* Step 3: Payment Method */}
            <PaymentStep
              currentStep={currentStep}
              completedSteps={completedSteps}
              paymentTab={paymentTab}
              setPaymentTab={setPaymentTab}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              isProcessing={isProcessing}
              isPayForMeValid={isPayForMeValid}
              isDeliveryValid={isDeliveryValid}
              payForMeDetails={payForMeDetails}
              setPayForMeDetails={setPayForMeDetails}
              dva={{ isInitializingDva: dva.isInitializingDva }}
              newsletterOptIn={newsletterOptIn}
              setNewsletterOptIn={setNewsletterOptIn}
              handlePlaceOrder={handlePlaceOrder}
              setCurrentStep={setCurrentStep}
              merchant={merchant}
              user={user}
              remainingAmount={remainingAmount}
            />

          </div>

          {/* RIGHT COLUMN: Order Summary */}
          <OrderSummarySidebar
            items={cart}
            resumedOrder={resumedOrder}
            cartTotal={cartTotal}
            deliveryCost={deliveryCost}
            remainingAmount={remainingAmount}
            walletAmountUsed={walletAmountUsed}
            orderTotals={orderTotals}
            taxRate={taxRate}
            deliveryMethod={deliveryMethod}
            selectedQuoteId={selectedQuoteId}
            giftWrappingCost={giftWrappingCost}
            walletLoading={walletLoading}
            walletBalance={walletBalance}
            payWithWallet={payWithWallet}
            setPayWithWallet={setPayWithWallet}
            user={user}
            newsletterOptIn={newsletterOptIn}
            setNewsletterOptIn={setNewsletterOptIn}
            paymentMethod={paymentMethod}
            isProcessing={isProcessing}
            isPayForMeValid={isPayForMeValid}
            handlePlaceOrder={handlePlaceOrder}
          />
        </div>
      </div>

    </div >
  );
};
