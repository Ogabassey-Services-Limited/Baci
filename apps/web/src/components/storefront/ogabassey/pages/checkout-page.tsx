'use client';

import {
  AlertCircle,
  Building2,
  ChevronRight,
  CreditCard,
  Loader2,
  Plane,
  ShieldCheck,
  Truck,
  Check,
  Copy,
  Clock,
  User,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';
import { SmartQuoteLoader } from '../components/SmartQuoteLoader';
import { PaystackLogo, CredPalLogo, CreditDirectLogo, JuicywayLogo, BankTransferLogo } from '../components/PaymentLogos';
import { MobileOrderSummary } from '../components/MobileCheckoutComponents';
import { useRouter, useSearchParams } from 'next/navigation';
import type React from 'react';
import { useEffect, useState, useRef } from 'react';
import { useCart } from '@/hooks/use-cart';
import { useMerchantSafe } from '@/hooks/use-merchant';
import {
  usePersistedForm,
  usePersistedState,
} from '@/hooks/use-persisted-state';
import { useAuthSafe } from '@/contexts/auth-context';
import { PhoneInput } from '@/components/ui/phone-input';
import { CheckoutAuthModal } from '@/components/storefront/checkout-auth-modal';
import { AddressAutocomplete } from '@/components/address-autocomplete';
import { openCredPalCheckout } from '@/lib/credpal';
import { openCreditDirectCheckout } from '@/lib/credit-direct-client';
import { asRoute } from '@/lib/routes';
import { toast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';
import { calculateCommerce } from '@/lib/supabase/client';
import { buildCheckoutOrderItems } from '@/lib/checkout/build-order-items';
import {
  isBankTransferCheckoutAvailable,
  isPaystackCheckoutAvailable,
} from '@/lib/checkout/payment-gateway-availability';
import { isValidPhoneNumber } from 'react-phone-number-input';
import {
  buildPendingCheckoutFingerprint,
  CHECKOUT_PENDING_ORDER_STORAGE_KEY,
  normalizeOrderPaymentMethod,
  resolvePendingCheckoutOrder,
  type PendingCheckoutOrderSnapshot,
} from './checkout/pending-checkout-order';

interface SavedAddress {
  id: number;
  label: string;
  address: string;
  phone: string;
  isDefault: boolean;
}

interface ShippingLocation {
  city: string;
  state: string;
}

interface ShippingQuote {
  id: string;
  provider: string;
  serviceTier: string;
  carrierName: string;
  displayName: string;
  price: number;
  estimatedDays: number;
  currency: string;
}

interface QuoteResponse {
  quotes: {
    featured: ShippingQuote[];
    all: ShippingQuote[];
  };
  sessionId: string;
}

export const CheckoutPage: React.FC = () => {
  const { cart, cartTotal, clearCart, isHydrated } = useCart();
  const merchantContext = useMerchantSafe();
  const merchant = merchantContext?.merchant;
  const paystackCheckoutAvailable = isPaystackCheckoutAvailable(merchant);
  const bankTransferCheckoutAvailable =
    isBankTransferCheckoutAvailable(merchant);
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
  const setFirstName = (v: string) => setCheckoutField('firstName', v);
  const setLastName = (v: string) => setCheckoutField('lastName', v);
  const setCustomerEmail = (v: string) => setCheckoutField('customerEmail', v);
  const setCustomerPhone = (v: string) => setCheckoutField('customerPhone', v);
  const setNewAddressStreet = (v: string) => setCheckoutField('newAddressStreet', v);
  const setNewAddressState = (v: string) => setCheckoutField('newAddressState', v);
  const setNewAddressCity = (v: string) => setCheckoutField('newAddressCity', v);
  const setCurrentStep = (v: 'contact' | 'delivery' | 'payment') => setCheckoutField('currentStep', v);
  const setCompletedSteps = (v: { contact: boolean; delivery: boolean } | ((prev: { contact: boolean; delivery: boolean }) => { contact: boolean; delivery: boolean })) => {
    if (typeof v === 'function') {
      setCheckoutField('completedSteps', v(completedSteps));
    } else {
      setCheckoutField('completedSteps', v);
    }
  };
  const [
    pendingCheckoutOrder,
    setPendingCheckoutOrder,
    clearPendingCheckoutOrder,
  ] = usePersistedState<PendingCheckoutOrderSnapshot | null>(
    CHECKOUT_PENDING_ORDER_STORAGE_KEY,
    null
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
  const rawIsContactValid = (() => {
    const hasRequiredFields = firstName.trim() && lastName.trim() && customerEmail.trim() && customerPhone;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isPhoneValid = customerPhone && isValidPhoneNumber(customerPhone);
    return !!(hasRequiredFields && emailRegex.test(customerEmail.trim()) && isPhoneValid);
  })();
  const isContactValid = isHydrated ? rawIsContactValid : false;


  // Crypto payment modal state
  const [cryptoPaymentData, setCryptoPaymentData] = useState<{
    address: string;
    chain: string;
    currency: string;
    amount: number;
    confirmation_time: string;
    orderId: string;
    trackingToken?: string;
    reference: string;
    sessionId: string; // Payment session ID (from initialization)
    paymentId: string; // Payment ID (from capture) - used for verification via GET /payments/{id}
    qrcode?: string;
  } | null>(null);

  // Dedicated Virtual Account (DVA) state
  const [dvaData, setDvaData] = useState<{
    account_number: string;
    account_name: string;
    bank_name: string;
    bank_code: string;
    amount: number;
    reference: string;
  } | null>(null);
  const [isInitializingDva, setIsInitializingDva] = useState(false);
  const [dvaCountdown, setDvaCountdown] = useState(3600); // 1 hour in seconds

  // Crypto payment verification state
  const [isVerifyingCrypto, setIsVerifyingCrypto] = useState(false);
  const [cryptoVerificationStatus, setCryptoVerificationStatus] = useState<'idle' | 'checking' | 'confirmed' | 'pending' | 'failed'>('idle');

  // Crypto selection state (before payment is initialized)
  const [showCryptoSelector, setShowCryptoSelector] = useState(false);
  const [selectedCryptoChain, setSelectedCryptoChain] = useState<'TRX' | 'ETH' | 'MATIC' | 'AVAXC'>('TRX');
  const [selectedCryptoCurrency, setSelectedCryptoCurrency] = useState<'USDT' | 'USDC'>('USDT');
  const [pendingCryptoOrder, setPendingCryptoOrder] = useState<{
    orderId: string;
    trackingToken?: string;
    amount: number;
    customerEmail: string;
    customerName: string;
    customerPhone: string;
    billingAddress: {
      line1: string;
      city: string;
      state: string;
      country: string;
      zip_code: string;
    };
    items: Array<{ name: string; type: 'physical' | 'digital' }>;
  } | null>(null);
  const [isInitializingCrypto, setIsInitializingCrypto] = useState(false);

  // Mobile app order resume state
  // When opening from mobile app with ?orderId=xxx&gateway=credpal, we resume that order
  const resumeOrderId = searchParams.get('orderId');
  const resumeTrackingToken =
    searchParams.get('trackingToken') ||
    searchParams.get('tracking_token') ||
    searchParams.get('token');
  const resumeMerchantSlug =
    searchParams.get('merchant_slug') ||
    searchParams.get('slug') ||
    merchant?.slug ||
    null;
  const preferredGateway = searchParams.get('gateway') as 'credpal' | 'credit_direct' | null;
  const [resumedOrder, setResumedOrder] = useState<{
    id: string;
    short_id: string;
    subtotal: number;
    shipping_cost: number;
    total: number;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    tracking_token?: string;
    shipping_address: {
      address: string;
      city: string;
      state: string;
      phone: string;
    };
    items: Array<{
      id: string;
      product_id: string;
      product_name: string;
      quantity: number;
      price: number;
      image_url?: string;
    }>;
  } | null>(null);
  const [isLoadingResumedOrder, setIsLoadingResumedOrder] = useState(!!resumeOrderId);
  const [resumeOrderError, setResumeOrderError] = useState<string | null>(null);
  const autoTriggerRef = useRef(false);
  // Double-submit protection: prevents race conditions from rapid clicks
  const isOrderInFlightRef = useRef(false);

  // Chain/currency compatibility
  const cryptoChainSupport: Record<'USDT' | 'USDC', Array<'TRX' | 'ETH' | 'MATIC' | 'AVAXC'>> = {
    USDT: ['TRX', 'ETH'],
    USDC: ['ETH', 'MATIC', 'AVAXC'],
  };

  // When currency changes, ensure chain is compatible
  const handleCryptoCurrencyChange = (currency: 'USDT' | 'USDC') => {
    setSelectedCryptoCurrency(currency);
    const supportedChains = cryptoChainSupport[currency];
    if (!supportedChains.includes(selectedCryptoChain)) {
      setSelectedCryptoChain(supportedChains[0]);
    }
  };

  // Initialize crypto payment with selected options
  const initializeCryptoPayment = async () => {
    if (!pendingCryptoOrder || !merchant) return;

    setIsInitializingCrypto(true);
    try {
      const paymentResponse = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant_id: merchant.id,
          order_id: pendingCryptoOrder.orderId,
          amount: pendingCryptoOrder.amount,
          currency: 'NGN',
          customer_email: pendingCryptoOrder.customerEmail,
          customer_name: pendingCryptoOrder.customerName,
          customer_phone: pendingCryptoOrder.customerPhone,
          gateway: 'juicyway',
          billing_address: pendingCryptoOrder.billingAddress,
          items: pendingCryptoOrder.items,
          crypto_chain: selectedCryptoChain,
          crypto_currency: selectedCryptoCurrency,
        }),
      });

      if (!paymentResponse.ok) {
        const errorData = await paymentResponse.json();
        throw new Error(errorData.details || errorData.error || 'Payment initialization failed');
      }

      const paymentResult = await paymentResponse.json();

      if (paymentResult.success && paymentResult.crypto_payment) {
        setShowCryptoSelector(false);
        setCryptoPaymentData({
          address: paymentResult.crypto_payment.address,
          chain: paymentResult.crypto_payment.chain,
          currency: paymentResult.crypto_payment.currency,
          amount: paymentResult.crypto_payment.amount / 100,
          confirmation_time: paymentResult.crypto_payment.confirmation_time,
          orderId: pendingCryptoOrder.orderId,
          trackingToken: pendingCryptoOrder.trackingToken,
          reference: paymentResult.reference,
          sessionId: paymentResult.session_id || '',
          paymentId: paymentResult.crypto_payment.payment_id || '', // Payment ID for verification
          qrcode: paymentResult.crypto_payment.qrcode,
        });
      } else {
        throw new Error('Failed to generate crypto payment address');
      }
    } catch (error) {
      console.error('Crypto payment initialization error:', error);
      toast({
        title: 'Crypto Payment Failed',
        description: error instanceof Error ? error.message : 'Failed to initialize crypto payment',
        variant: 'destructive',
      });
    } finally {
      setIsInitializingCrypto(false);
    }
  };

  // Verify crypto payment status by polling the API
  // Uses a ref to track polling state to avoid stale closure issues
  const pollingRef = useRef<{ intervalId: NodeJS.Timeout | null; attempts: number }>({
    intervalId: null,
    attempts: 0,
  });

  const verifyCryptoPayment = async () => {
    // Use paymentId for verification (from the capture response)
    // Fall back to sessionId if paymentId is not available
    const verificationId = cryptoPaymentData?.paymentId || cryptoPaymentData?.sessionId;

    if (!verificationId) {
      console.error('No payment ID or session ID available for verification');
      setCryptoVerificationStatus('failed');
      return;
    }

    setIsVerifyingCrypto(true);
    setCryptoVerificationStatus('checking');
    pollingRef.current.attempts = 0;

    const checkPaymentStatus = async (): Promise<'confirmed' | 'failed' | 'pending'> => {
      try {
        // Use payment_id parameter for GET /payments/{id} endpoint
        const response = await fetch(
          `/api/payments/status?gateway=juicyway&payment_id=${verificationId}`
        );

        if (!response.ok) {
          // Try to parse error, but handle JSON parse failures gracefully
          let errorData = {};
          try {
            errorData = await response.json();
          } catch {
            errorData = { message: `HTTP ${response.status}: ${response.statusText}` };
          }
          console.error('Payment status check failed:', {
            status: response.status,
            statusText: response.statusText,
            paymentId: verificationId,
            error: errorData,
          });
          return 'pending'; // Treat API errors as pending, not failed
        }

        const result = await response.json();

        if (result.is_confirmed) {
          return 'confirmed';
        }

        if (result.is_failed) {
          return 'failed';
        }

        return 'pending';
      } catch (error) {
        console.error('Payment verification error:', error);
        return 'pending';
      }
    };

    // Initial check
    const initialStatus = await checkPaymentStatus();

    if (initialStatus === 'confirmed') {
      setIsVerifyingCrypto(false);
      setCryptoVerificationStatus('confirmed');
      clearPendingCheckoutOrder();
      clearCheckoutSession();
      clearCart();
      const successQuery = new URLSearchParams({
        type: 'crypto',
        orderId: cryptoPaymentData.orderId,
        reference: cryptoPaymentData.reference,
      });
      if (cryptoPaymentData.trackingToken) {
        successQuery.set('trackingToken', cryptoPaymentData.trackingToken);
      }
      router.push(asRoute(getHref(`/order-success?${successQuery.toString()}`)));
      return;
    }

    if (initialStatus === 'failed') {
      setIsVerifyingCrypto(false);
      setCryptoVerificationStatus('failed');
      return;
    }

    // Start polling
    setCryptoVerificationStatus('pending');

    pollingRef.current.intervalId = setInterval(async () => {
      pollingRef.current.attempts++;
      const maxAttempts = 30; // 5 minutes (30 * 10 seconds)

      if (pollingRef.current.attempts >= maxAttempts) {
        if (pollingRef.current.intervalId) {
          clearInterval(pollingRef.current.intervalId);
          pollingRef.current.intervalId = null;
        }
        setIsVerifyingCrypto(false);
        setCryptoVerificationStatus('pending');
        return;
      }

      const status = await checkPaymentStatus();

      if (status === 'confirmed') {
        if (pollingRef.current.intervalId) {
          clearInterval(pollingRef.current.intervalId);
          pollingRef.current.intervalId = null;
        }
        setIsVerifyingCrypto(false);
        setCryptoVerificationStatus('confirmed');
        clearPendingCheckoutOrder();
        clearCheckoutSession();
        clearCart();
        const successQuery = new URLSearchParams({
          type: 'crypto',
          orderId: cryptoPaymentData.orderId,
          reference: cryptoPaymentData.reference,
        });
        if (cryptoPaymentData.trackingToken) {
          successQuery.set('trackingToken', cryptoPaymentData.trackingToken);
        }
        router.push(asRoute(getHref(`/order-success?${successQuery.toString()}`)));
      } else if (status === 'failed') {
        if (pollingRef.current.intervalId) {
          clearInterval(pollingRef.current.intervalId);
          pollingRef.current.intervalId = null;
        }
        setIsVerifyingCrypto(false);
        setCryptoVerificationStatus('failed');
      }
    }, 10000); // Poll every 10 seconds
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current.intervalId) {
        clearInterval(pollingRef.current.intervalId);
      }
    };
  }, []);

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

  // Shipping State
  const [shippingStates, setShippingStates] = useState<string[]>([]);
  const [shippingCities, setShippingCities] = useState<string[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [shippingQuotes, setShippingQuotes] = useState<ShippingQuote[]>([]);
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string>('');

  // Delivery step validation (hydration-safe)
  const rawIsDeliveryValid = (() => {
    if (!deliveryMethod) return false;
    // For door delivery, a shipping quote MUST be selected
    if (deliveryMethod === 'door') return !!selectedQuoteId;
    // For airport, a type (pickup/delivery) must be selected
    if (deliveryMethod === 'airport') return !!airportType;
    // Pickup is valid as long as the state matches (handled by UI selection enforcement)
    return true;
  })();
  const isDeliveryValid = isHydrated ? rawIsDeliveryValid : false;

  // Note: newAddressState, newAddressCity, newAddressStreet are now part of checkoutForm (persisted)


  // Fetch resumed order from mobile app when orderId is in URL
  useEffect(() => {
    if (!resumeOrderId || !resumeMerchantSlug) return;

    const fetchResumedOrder = async () => {
      setIsLoadingResumedOrder(true);
      try {
        const query = new URLSearchParams();
        query.set('merchant_slug', resumeMerchantSlug);
        if (resumeTrackingToken) query.set('token', resumeTrackingToken);

        const res = await fetch(
          query.toString()
            ? `/api/storefront/orders/${resumeOrderId}?${query.toString()}`
            : `/api/storefront/orders/${resumeOrderId}`
        );
        if (res.ok) {
          const orderData = await res.json();
          setResumedOrder({
            id: orderData.id,
            short_id: orderData.short_id,
            subtotal: orderData.subtotal,
            shipping_cost: orderData.shipping_cost || 0,
            total: orderData.total,
            customer_name: orderData.customer_name,
            customer_email: orderData.customer_email,
            customer_phone: orderData.customer_phone,
            tracking_token: orderData.tracking_token,
            shipping_address: orderData.shipping_address || {
              address: '',
              city: '',
              state: '',
              phone: '',
            },
            items: orderData.items || [],
          });

          // Pre-fill form with order data
          const [first, ...rest] = (orderData.customer_name || '').split(' ');
          setCheckoutFields({
            firstName: first || '',
            lastName: rest.join(' ') || '',
            customerEmail: orderData.customer_email || '',
            customerPhone: orderData.customer_phone || '',
            newAddressStreet: orderData.shipping_address?.address || '',
            newAddressState: orderData.shipping_address?.state || '',
            newAddressCity: orderData.shipping_address?.city || '',
            // Skip directly to payment step for resumed orders
            currentStep: 'payment',
            completedSteps: { contact: true, delivery: true },
          });

          // 2025 FIX: Sync paymentTab with preferredGateway to prevent UI crash
          // If a BNPL gateway is selected, we MUST switch to the 'installments' tab
          if (preferredGateway === 'credit_direct' || preferredGateway === 'credpal') {
            setPaymentTab('installments');
            setPaymentMethod(preferredGateway);
          } else if (preferredGateway) {
            setPaymentTab('full');
            setPaymentMethod(preferredGateway);
          }

        } else {
          console.error('Failed to fetch resumed order');
          setResumeOrderError('Order not found. It may have been completed or expired.');
        }
      } catch (error) {
        console.error('Error fetching resumed order:', error);
        setResumeOrderError('Failed to load order details. Please try again.');
      } finally {
        setIsLoadingResumedOrder(false);
      }
    };
    fetchResumedOrder();
  }, [
    preferredGateway,
    resumeOrderId,
    resumeMerchantSlug,
    resumeTrackingToken,
    setCheckoutFields,
  ]);

  // Fetch States on mount
  useEffect(() => {
    const fetchLocations = async () => {
      setIsLoadingLocations(true);
      try {
        const res = await fetch('/api/shipping/locations');
        if (res.ok) {
          const data = await res.json();
          setShippingStates(data.states || []);
        }
      } catch (error) {
        console.error('Failed to fetch states', error);
      } finally {
        setIsLoadingLocations(false);
      }
    };
    fetchLocations();
  }, []);

  // Fetch Cities when State changes
  useEffect(() => {
    if (!newAddressState) {
      setShippingCities([]);
      return;
    }
    const fetchCities = async () => {
      try {
        const res = await fetch(
          `/api/shipping/locations?state=${encodeURIComponent(newAddressState)}`
        );
        if (res.ok) {
          const data = await res.json();
          // Extract unique cities from the locations
          const cities = [
            ...new Set((data.locations as ShippingLocation[]).map((l) => l.city)),
          ].sort();
          setShippingCities(cities);
        }
      } catch (error) {
        console.error('Failed to fetch cities', error);
      }
    };
    fetchCities();
  }, [newAddressState]);

  // Function to fetch quotes
  const fetchShippingQuotes = async (
    address: string,
    state: string,
    city: string,
    phone: string,
    firstName: string,
    lastName: string,
    email: string
  ) => {
    if (!state || !city || !address) return;

    setIsLoadingQuotes(true);
    // setShippingQuotes([]); // KPI: Keep previous quotes visible to avoid UI flash (Optimistic UI)
    setSelectedQuoteId('');

    try {
      const res = await fetch('/api/shipping/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiver: {
            name: `${firstName} ${lastName}`.trim() || 'Valued Customer', // Fallback for guest who hasn't typed name yet
            email: email || 'guest@example.com',
            phone: phone || '',
            address,
            city,
            state,
            country: 'Nigeria',
          },
          items: cart.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            weight: 1, // Default weight 1kg if not strictly defined
            value: item.negotiatedPrice || item.price,
          })),
        }),
      });

      if (res.ok) {
        const data: QuoteResponse = await res.json();
        setShippingQuotes(data.quotes.all);

        // Auto-select the first (cheapest) quote if available
        if (data.quotes.all.length > 0) {
          setSelectedQuoteId(data.quotes.all[0].id);
        }
      } else {
        console.warn('Failed to fetch quotes:', await res.text());
      }
    } catch (error) {
      console.error('Error fetching shipping quotes:', error);
    } finally {
      setIsLoadingQuotes(false);
    }
  };

  // Trigger quote fetch when Door Delivery is selected and we have BOTH state AND city
  useEffect(() => {
    if (deliveryMethod === 'door') {
      if (isNewAddressMode) {
        // STRICT: Only fetch if BOTH State AND City are explicitly selected
        // Do NOT use fallbacks - wait for proper location input
        if (newAddressState && newAddressCity) {
          fetchShippingQuotes(
            newAddressStreet || `${newAddressCity}, ${newAddressState}`, // Use city+state as fallback address for API
            newAddressState,
            newAddressCity,
            customerPhone,
            firstName,
            lastName,
            customerEmail
          );
        }
      } else {
        const saved = addresses.find((a) => a.id === selectedAddressId);
        if (saved) {
          // Attempt to extract state/city from saved address string
          // Logic: "Address, City, State" or just "Address" (risky)
          // Improved logic: Try to match against shippingStates if possible, or just send last parts
          const parts = saved.address.split(',').map((s) => s.trim());

          if (parts.length >= 2) {
            const stateCandidate = parts[parts.length - 1];
            const cityCandidate = parts[parts.length - 2];

            // Basic verification: is stateCandidate in our shippingStates list? 
            // (Might be empty if not loaded yet, so just send it)
            if (stateCandidate && cityCandidate) {
              fetchShippingQuotes(
                saved.address,
                stateCandidate,
                cityCandidate,
                saved.phone,
                firstName,
                lastName,
                customerEmail
              );
            }
          }
        }
      }
    }
  }, [
    deliveryMethod,
    selectedAddressId,
    isNewAddressMode,
    // Trigger on State/City change for new address. 
    // NOT triggering on newAddressStreet change to avoid excessive API calls while typing.
    newAddressState,
    newAddressCity,
    // Trigger if we switch back to a saved address
    addresses
  ]);


  // Payment State
  const [paymentTab, setPaymentTab] = useState<'full' | 'installments'>('full');
  const [paymentMethod, setPaymentMethod] = useState<'paystack' | 'korapay' | 'juicyway' | 'credpal' | 'credit_direct' | 'invoice' | 'payforme' | 'pod' | 'bank_transfer' | ''>('');

  // Wallet state (2025: auto-apply when balance > 0)
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletLoading, setWalletLoading] = useState(false);
  const [payWithWallet, setPayWithWallet] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderTotals, setOrderTotals] = useState<{ total: number; taxAmount: number } | null>(null);

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

  // Fetch wallet balance for logged-in customers (2025 best practice: auto-apply at checkout)
  useEffect(() => {
    const abortController = new AbortController();

    const fetchWalletBalance = async () => {
      if (!user || !merchant?.slug) return;

      setWalletLoading(true);
      try {
        const response = await fetch(
          `/api/storefront/customer/wallet?merchant=${merchant.slug}`,
          { signal: abortController.signal }
        );
        if (response.ok) {
          const data = await response.json();
          const balance = Number(data.balance) || 0;
          setWalletBalance(balance);
          // Auto-apply wallet credit if balance > 0 (Shopify 2025 pattern)
          if (balance > 0) {
            setPayWithWallet(true);
          }
        }
      } catch (error) {
        // Ignore abort errors (component unmounted)
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Failed to fetch wallet balance:', error);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setWalletLoading(false);
        }
      }
    };

    fetchWalletBalance();

    return () => abortController.abort();
  }, [user, merchant?.slug]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Date Calculation for Door Delivery
  const getDeliveryDateRange = () => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() + 1);
    const end = new Date(today);
    end.setDate(today.getDate() + 3);

    const options: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'short',
    };
    return `${start.toLocaleDateString('en-GB', options)} to ${end.toLocaleDateString('en-GB', options)}`;
  };

  const deliveryCost =
    deliveryMethod === 'pickup'
      ? 0
      : deliveryMethod === 'door'
        ? selectedQuoteId
          ? shippingQuotes.find(q => String(q.id) === String(selectedQuoteId))?.price ?? 0
          : 0 // Fallback: 0 if loading or no quote selected
        : airportType === 'delivery' ? 25000 : 20000; // Airport Delivery: ₦25,000, Airport Pickup: ₦20,000

  const total = orderTotals?.total || (cartTotal + deliveryCost + giftWrappingCost);

  // Wallet credit calculation (2025: can't redeem more than order total)
  const walletAmountUsed = payWithWallet ? Math.min(walletBalance, total) : 0;
  const remainingAmount = total - walletAmountUsed;


  const taxRate = merchant?.vat_registration_status === 'registered'
    ? (merchant.vat_rate ?? 7.5) / 100
    : 0;

  useEffect(() => {
    const fetchTotals = async () => {
      try {
        const result = await calculateCommerce('calculate_order', {
          subtotal: cartTotal,
          shippingFee: deliveryCost,
          taxRate,
        });
        setOrderTotals(result);
      } catch (err) {
        console.error("Failed to fetch totals from brain", err);
      }
    };
    fetchTotals();
  }, [cartTotal, deliveryCost, taxRate]);

  // Handler for direct payment execution (CredPal/Credit Direct)
  const executeDirectPayment = async () => {
    if (!resumedOrder || !preferredGateway) return;

    setIsProcessing(true);
    try {
      const paymentAmount = resumedOrder.total;

      // For CredPal, use the inline checkout widget
      if (preferredGateway === 'credpal') {
        const { openCredPalCheckout, getCredPalKey } = await import('@/lib/credpal');
        const productNames = resumedOrder.items.map(item => item.product_name).join(', ') || 'Purchase';

        await openCredPalCheckout({
          key: getCredPalKey(),
          amount: paymentAmount,
          product: productNames,
          customerEmail: resumedOrder.customer_email,
          customerName: resumedOrder.customer_name,
          customerPhone: resumedOrder.customer_phone,
          onSuccess: async (data) => {
            // Update order with payment reference
            await fetch(`/api/orders/update-payment-ref`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderId: resumedOrder.id,
                paymentRef: data.order_no,
                gateway: 'credpal',
              }),
            });
            clearCheckoutSession();
            const successQuery = new URLSearchParams({
              orderId: resumedOrder.id,
              type: 'credpal',
            });
            if (resumedOrder.tracking_token) {
              successQuery.set('trackingToken', resumedOrder.tracking_token);
            }
            router.push(
              asRoute(getHref(`/order-success?${successQuery.toString()}`))
            );
          },
          onError: (error) => {
            toast({
              title: 'Payment Failed',
              description: error.message || 'CredPal payment failed',
              variant: 'destructive',
            });
            setIsProcessing(false);
          },
          onClose: () => {
            setIsProcessing(false);
          },
        });
        return;
      }

      // For Credit Direct, use their checkout widget
      if (preferredGateway === 'credit_direct') {
        const { openCreditDirectCheckout } = await import('@/lib/credit-direct-client');

        await openCreditDirectCheckout({
          merchantSlug: merchant?.slug || 'ogabassey',
          orderId: resumedOrder.id,
          amount: paymentAmount,
          customerEmail: resumedOrder.customer_email,
          customerPhone: resumedOrder.customer_phone,
          customerName: resumedOrder.customer_name,
          items: resumedOrder.items.map(item => ({
            id: item.product_id,
            name: item.product_name,
            price: item.price,
            quantity: item.quantity,
          })),
          onSuccess: async (transactionId) => {
            await fetch(`/api/orders/update-payment-ref`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderId: resumedOrder.id,
                paymentRef: transactionId,
                gateway: 'credit_direct',
              }),
            });
            clearCheckoutSession();
            const successQuery = new URLSearchParams({
              orderId: resumedOrder.id,
              type: 'credit_direct',
            });
            if (resumedOrder.tracking_token) {
              successQuery.set('trackingToken', resumedOrder.tracking_token);
            }
            router.push(
              asRoute(getHref(`/order-success?${successQuery.toString()}`))
            );
          },
          onError: (error) => {
            toast({
              title: 'Payment Failed',
              description: error || 'Credit Direct payment failed',
              variant: 'destructive',
            });
            setIsProcessing(false);
          },
          onClose: () => {
            setIsProcessing(false);
          },
        });
        return;
      }
    } catch (error) {
      console.error('Payment execution error:', error);
      setIsProcessing(false);
    }
  };

  // Auto-trigger payment for resumed orders
  useEffect(() => {
    if (resumedOrder && preferredGateway && !autoTriggerRef.current && !isProcessing) {
      autoTriggerRef.current = true;
      executeDirectPayment();
    }
  }, [resumedOrder, preferredGateway]);

  useEffect(() => {
    if (
      pendingCheckoutOrder &&
      merchant?.id &&
      pendingCheckoutOrder.merchantId !== merchant.id
    ) {
      clearPendingCheckoutOrder();
    }
  }, [pendingCheckoutOrder, merchant?.id, clearPendingCheckoutOrder]);

  const handlePlaceOrder = async () => {
    // Double-submit protection: prevent race conditions from rapid clicks
    if (isOrderInFlightRef.current) {
      return;
    }
    isOrderInFlightRef.current = true;

    if (!merchant?.id) {
      toast({
        title: 'Error',
        description: 'Merchant context not available. Please try again.',
        variant: 'destructive',
      });
      isOrderInFlightRef.current = false;
      return;
    }

    if (!customerEmail || !firstName || !lastName) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in your name and email.',
        variant: 'destructive',
      });
      isOrderInFlightRef.current = false;
      return;
    }

    setIsProcessing(true);

    // Handle resumed orders from mobile app (order already exists, just need payment)
    if (resumedOrder && preferredGateway) {
      await executeDirectPayment();
      return;
    }

    const selectedAddress = addresses.find((a) => a.id === selectedAddressId);

    // Construct address string properly based on delivery method
    let finalAddress = 'Address not provided';
    let finalCity = '';
    let finalState = '';

    // Only require full address for door delivery
    if (deliveryMethod === 'door') {
      if (isNewAddressMode) {
        if (!newAddressStreet || !newAddressCity || !newAddressState) {
          toast({
            title: 'Incomplete Address',
            description: 'Please enter your full address (Street, City, State).',
            variant: 'destructive',
          });
          setIsProcessing(false);
          return;
        }
        finalAddress = `${newAddressStreet}, ${newAddressCity}, ${newAddressState}`;
        finalCity = newAddressCity;
        finalState = newAddressState;
      } else {
        finalAddress = selectedAddress?.address || 'Address not provided';
        // Try to parse city/state from saved string if possible
        const parts = finalAddress.split(',');
        if (parts.length >= 2) {
          finalState = parts[parts.length - 1]?.trim() || '';
          finalCity = parts[parts.length - 2]?.trim() || '';
        }
      }
    } else if (deliveryMethod === 'pickup') {
      finalAddress = 'Pickup at Store';
      finalCity = 'Lagos';
      finalState = 'Lagos';
    } else if (deliveryMethod === 'airport') {
      // For airport, use the city/state from address if available, otherwise use defaults
      finalAddress = newAddressStreet || `Airport ${airportType === 'pickup' ? 'Pickup' : 'Delivery'}`;
      finalCity = newAddressCity || 'Airport';
      finalState = newAddressState || 'Nigeria';
    }

    const shippingAddressData = {
      address: finalAddress,
      city: finalCity,
      state: finalState,
      phone: customerPhone || selectedAddress?.phone || '',
    };

    // Identify selected shipping provider
    let shippingProvider = 'Standard';
    let trackingNumber = undefined;

    // Prepare order items for API
    const orderItems = buildCheckoutOrderItems(cart);

    if (deliveryMethod === 'door' && selectedQuoteId) {
      const quote = shippingQuotes.find(q => String(q.id) === String(selectedQuoteId));
      if (quote) {
        shippingProvider = quote.provider; // e.g. 'GIGL', 'Topship'
      }
    } else if (deliveryMethod === 'pickup') {
      shippingProvider = 'Pickup';
    } else if (deliveryMethod === 'airport') {
      shippingProvider = 'Airport';
    }

    const normalizedPaymentMethod = normalizeOrderPaymentMethod(paymentMethod);
    const checkoutFingerprint = buildPendingCheckoutFingerprint({
      merchantId: merchant.id,
      customerEmail,
      customerName: `${firstName} ${lastName}`.trim(),
      customerPhone,
      deliveryMethod,
      shippingFee: deliveryCost,
      shippingProvider,
      selectedQuoteId:
        deliveryMethod === 'door' ? selectedQuoteId || undefined : undefined,
      shippingAddress: shippingAddressData,
      items: orderItems.map((item) => ({
        product_id: item.product_id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        has_assurance: item.has_assurance,
        assurance_fee: item.assurance_fee,
      })),
      useWalletCredit: payWithWallet && walletAmountUsed > 0,
      walletAmountUsed,
    });

    try {
      let order: {
        id: string;
        order_number?: string;
        tracking_token?: string;
      };
      let walletResult: {
        amountUsed: number;
        newBalance: number;
      } | null = null;
      let amountDueToGateway = total;

      const reusablePendingOrder = await resolvePendingCheckoutOrder({
        pendingOrder: pendingCheckoutOrder,
        merchantId: merchant.id,
        merchantSlug: merchant.slug,
        customerEmail,
        checkoutFingerprint,
        paymentMethod: normalizedPaymentMethod,
        shippingProvider,
        selectedQuoteId:
          deliveryMethod === 'door' ? selectedQuoteId || undefined : undefined,
      });

      if (reusablePendingOrder.clearStoredOrder) {
        clearPendingCheckoutOrder();
      }

      if (reusablePendingOrder.reusableOrder) {
        order = reusablePendingOrder.reusableOrder.order;
        amountDueToGateway = reusablePendingOrder.reusableOrder.amountDueToGateway;
      } else {
        // 1. Create order in database via API (with wallet redemption if applicable)
        const orderResponse = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            merchant_id: merchant.id,
            customer_email: customerEmail,
            customer_name: `${firstName} ${lastName}`.trim(),
            customer_phone: customerPhone,
            items: orderItems,
            subtotal: cartTotal,
            shipping_fee: deliveryCost,
            payment_method: normalizedPaymentMethod,
            payment_status: 'unpaid',
            shipping_status: 'pending',
            shipping_address: shippingAddressData,
            source: 'online_store',
            shipping_provider: shippingProvider,
            selected_quote_id:
              deliveryMethod === 'door' ? selectedQuoteId || undefined : undefined,
            // Wallet redemption (2025: auto-apply at checkout)
            use_wallet_credit: payWithWallet && walletAmountUsed > 0,
            wallet_amount: walletAmountUsed,
            // Link customer to auth user (2025: unified customer identity)
            user_id: user?.id,
            // Marketing Consent
            accepts_marketing: newsletterOptIn,
          }),
        });

        if (!orderResponse.ok) {
          const errorData = await orderResponse.json();
          console.error('Order creation failed:', {
            status: orderResponse.status,
            error: errorData.error,
            details: errorData.details,
            fullResponse: errorData
          });
          throw new Error(errorData.details || errorData.error || 'Failed to create order');
        }

        const orderData = await orderResponse.json();
        order = orderData.order;
        walletResult = orderData.wallet;
        amountDueToGateway = orderData.amountDueToGateway ?? total;
      }

      // 1b. Create account if requested (Awaited to ensure session is set before moving to next page)
      if (createAccount && !user && accountPassword.length >= 6) {
        try {
          const supabase = createClient();
          await supabase.auth.signUp({
            email: customerEmail,
            password: accountPassword,
            options: {
              data: {
                first_name: firstName,
                last_name: lastName,
                phone: customerPhone,
                source: 'checkout',
                signup_type: 'customer'  // Prevents merchant record creation
              }
            }
          });
          console.log('Account created and session initialized');
        } catch (authError) {
          // Log but don't block the order if signup fails (e.g. email exists)
          console.error('Silent signup background error:', authError);
        }
      }

      setPendingCheckoutOrder({
        orderId: order.id,
        orderNumber: order.order_number,
        trackingToken: order.tracking_token,
        merchantId: merchant.id,
        customerEmail,
        checkoutFingerprint,
        amountDueToGateway,
        createdAt: new Date().toISOString(),
      });

      const paymentAmount = amountDueToGateway ?? total;

      // Update local wallet balance if redemption occurred
      if (walletResult?.amountUsed) {
        setWalletBalance(walletResult.newBalance);
      }

      // 2. Handle payment based on method
      // Special case: If wallet fully covers the order, no payment gateway needed
      // Order API already marks it as paid, just redirect to success
      if (paymentAmount <= 0) {
        clearPendingCheckoutOrder();
        clearCheckoutSession();
        // Defer clearCart to avoid flashing empty state before redirect
        const successQuery = new URLSearchParams({
          orderId: order.id,
          wallet: 'true',
        });
        if (order.tracking_token) {
          successQuery.set('trackingToken', order.tracking_token);
        }
        router.push(asRoute(getHref(`/order-success?${successQuery.toString()}`)));
        setTimeout(clearCart, 500);
        return;
      }

      if (paymentMethod === 'bank_transfer' && !bankTransferCheckoutAvailable) {
        throw new Error(
          'Bank transfer is not available for this store yet. Please choose a different payment method.'
        );
      }

      if (paymentMethod === 'paystack' && !paystackCheckoutAvailable) {
        throw new Error(
          'Paystack is not available for this store yet. Please choose a different payment method.'
        );
      }

      if (paymentMethod === 'bank_transfer') {
        await handleBankTransfer(order, paymentAmount);
        return;
      }

      if (paymentMethod === 'paystack' || paymentMethod === 'korapay' || paymentMethod === 'juicyway') {
        // For Juicyway crypto payments, show the selector first
        if (paymentMethod === 'juicyway') {
          setPendingCryptoOrder({
            orderId: order.id,
            trackingToken: order.tracking_token,
            amount: paymentAmount,
            customerEmail,
            customerName: `${firstName} ${lastName}`.trim(),
            customerPhone,
            billingAddress: {
              line1: newAddressStreet || finalAddress,
              city: finalCity,
              state: finalState,
              country: 'NG',
              zip_code: '100001',
            },
            items: cart.map(item => ({
              name: item.name,
              type: 'physical' as const,
            })),
          });
          setShowCryptoSelector(true);
          setIsProcessing(false);
          isOrderInFlightRef.current = false;
          return;
        }

        // Initialize payment via API - supports Paystack and Korapay
        // Amount is adjusted for wallet credit (if used)
        const paymentResponse = await fetch('/api/payments/initialize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            merchant_id: merchant.id,
            order_id: order.id,
            amount: paymentAmount,
            currency: 'NGN',
            customer_email: customerEmail,
            customer_name: `${firstName} ${lastName}`.trim(),
            customer_phone: customerPhone,
            gateway: paymentMethod,
          }),
        });

        if (!paymentResponse.ok) {
          const errorData = await paymentResponse.json();
          throw new Error(errorData.error || 'Payment initialization failed');
        }

        const paymentResult = await paymentResponse.json();

        if (paymentResult.success && paymentResult.crypto_payment) {
          // Juicyway crypto payment - show wallet address modal
          setCryptoPaymentData({
            address: paymentResult.crypto_payment.address,
            chain: paymentResult.crypto_payment.chain,
            currency: paymentResult.crypto_payment.currency,
            amount: paymentResult.crypto_payment.amount / 100, // Convert from minor units
            confirmation_time: paymentResult.crypto_payment.confirmation_time,
            orderId: order.id,
            trackingToken: order.tracking_token,
            reference: paymentResult.reference,
            sessionId: paymentResult.session_id || '',
            paymentId: paymentResult.crypto_payment.payment_id || '', // Payment ID for verification
          });
          setIsProcessing(false);
          isOrderInFlightRef.current = false;
          return;
        } else if (paymentResult.success && paymentResult.authorization_url) {
          // NOTE: Don't clear cart here - it causes a flash of empty state
          // Cart will be cleared on the payment callback page after successful payment
          window.location.href = paymentResult.authorization_url;
          return;
        } else if (paymentResult.success && paymentResult.checkout_url) {
          // Juicyway uses checkout_url
          window.location.href = paymentResult.checkout_url;
          return;
        } else {
          throw new Error('Payment initialization failed: No auth URL returned');
        }
      } else if (paymentMethod === 'credit_direct') {
        // Credit Direct BNPL - Client-side popup checkout
        // Note: BNPL typically uses full total (wallet credits may not apply)
        await openCreditDirectCheckout({
          merchantSlug: merchant.slug || '',
          orderId: order.id,
          amount: paymentAmount,
          customerEmail,
          customerPhone,
          customerName: `${firstName} ${lastName}`.trim(),

          items: (cart.length > 0 ? cart : resumedOrder?.items || []).map((item: any) => ({
            id: String(item.id || item.product_id), // Handle both cart items and resumed order items
            name: item.name || item.product_name,
            price: item.price,
            quantity: item.quantity,
          })),
          onSuccess: (transactionId) => {
            console.log('Credit Direct success:', transactionId);
            clearPendingCheckoutOrder();
            clearCheckoutSession();
            clearCart();
            const successQuery = new URLSearchParams({
              type: 'credit_direct',
              orderId: order.id,
              sessionId: transactionId,
            });
            if (order.tracking_token) {
              successQuery.set('trackingToken', order.tracking_token);
            }
            router.push(
              asRoute(getHref(`/order-success?${successQuery.toString()}`))
            );
          },
          onError: (error) => {
            console.error('Credit Direct error:', error);
            toast({
              title: 'Credit Direct Failed',
              description: error || 'Credit Direct checkout failed. Please try again.',
              variant: 'destructive',
            });
            setIsProcessing(false);
            isOrderInFlightRef.current = false;
          },
          onClose: () => {
            setIsProcessing(false);
            isOrderInFlightRef.current = false;
          },
          onPopup: (transactionId) => {
            console.log('Credit Direct popup opened:', transactionId);
          },
        });
        // Don't proceed further - callbacks handle the flow
        return;
      } else if (paymentMethod === 'credpal') {
        // CredPal BNPL - Client-side popup checkout
        const credpalKey = process.env.NEXT_PUBLIC_CREDPAL_KEY;

        if (!credpalKey) {
          // CredPal not configured - show error, don't proceed to success
          toast({
            title: 'CredPal Unavailable',
            description: 'CredPal payment is not available at this time. Please select a different payment method.',
            variant: 'destructive',
          });
          setIsProcessing(false);
          isOrderInFlightRef.current = false;
          return;
        }

        // Open CredPal popup
        await openCredPalCheckout({
          key: credpalKey,
          amount: paymentAmount,
          product: cart.map(item => item.name).join(', '),
          customerEmail,
          customerName: `${firstName} ${lastName}`.trim(),
          customerPhone,
          onSuccess: (data) => {
            console.log('CredPal success:', data);
            clearPendingCheckoutOrder();
            clearCheckoutSession();
            clearCart();
            const successQuery = new URLSearchParams({
              type: 'credpal',
              orderId: order.id,
              credpalRef: data.order_no,
            });
            if (order.tracking_token) {
              successQuery.set('trackingToken', order.tracking_token);
            }
            router.push(
              asRoute(getHref(`/order-success?${successQuery.toString()}`))
            );
          },
          onError: (error) => {
            console.error('CredPal error:', error);
            toast({
              title: 'CredPal Failed',
              description: error.message || 'CredPal checkout failed. Please try again.',
              variant: 'destructive',
            });
            setIsProcessing(false);
            isOrderInFlightRef.current = false;
          },
          onClose: () => {
            setIsProcessing(false);
            isOrderInFlightRef.current = false;
          },
        });
        // Don't proceed further - callbacks handle the flow
        return;
      } else if (paymentMethod === 'invoice') {
        // Invoice/Pay Later - order created, redirect to success
        clearPendingCheckoutOrder();
        clearCheckoutSession();
        const successQuery = new URLSearchParams({
          type: 'invoice',
          orderId: order.id,
        });
        if (order.tracking_token) {
          successQuery.set('trackingToken', order.tracking_token);
        }
        router.push(asRoute(getHref(`/order-success?${successQuery.toString()}`)));
        setTimeout(clearCart, 500);
      } else if (paymentMethod === 'payforme') {
        // Pay For Me - TODO: send payment link
        clearPendingCheckoutOrder();
        clearCheckoutSession();
        const successQuery = new URLSearchParams({
          type: 'payforme',
          orderId: order.id,
          payerName: payForMeDetails.name,
        });
        if (order.tracking_token) {
          successQuery.set('trackingToken', order.tracking_token);
        }
        router.push(asRoute(getHref(`/order-success?${successQuery.toString()}`)));
        setTimeout(clearCart, 500);
      } else {
        // Default: POD or other
        clearPendingCheckoutOrder();
        clearCheckoutSession();
        const successQuery = new URLSearchParams({
          type: 'standard',
          orderId: order.id,
        });
        if (order.tracking_token) {
          successQuery.set('trackingToken', order.tracking_token);
        }
        router.push(asRoute(getHref(`/order-success?${successQuery.toString()}`)));
        setTimeout(clearCart, 500);
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast({
        title: 'Checkout Failed',
        description: error instanceof Error
          ? error.message
          : 'An error occurred. Please try again.',
        variant: 'destructive',
      });
      setIsProcessing(false);
      // Reset double-submit protection on error so user can retry
      isOrderInFlightRef.current = false;
      // Keep user on payment step - don't reset their progress
      setCurrentStep('payment');
      // Ensure steps stay completed so user doesn't have to re-enter info
      setCompletedSteps({ contact: true, delivery: true });
    }
  };

  // Dedicated Virtual Account (DVA) Handler
  const handleBankTransfer = async (order: any, paymentAmount: number) => {
    if (!merchant) {
      isOrderInFlightRef.current = false;
      return;
    }

    setIsInitializingDva(true);
    try {
      const response = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant_id: merchant.id,
          order_id: order.id,
          amount: paymentAmount,
          currency: 'NGN',
          customer_email: customerEmail,
          customer_name: `${firstName} ${lastName}`.trim(),
          customer_phone: customerPhone,
          gateway: 'paystack',
          payment_type: 'dva', // Dedicated Virtual Account
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.error || 'Failed to initialize bank transfer'
        );
      }

      const result = await response.json();
      if (result.success && result.dva) {
        setDvaData({
          ...result.dva,
          amount: paymentAmount,
          reference: result.reference,
        });
        setDvaCountdown(3600);
        isOrderInFlightRef.current = false;
      } else {
        throw new Error('DVA not returned by the gateway');
      }
    } catch (error) {
      console.error('DVA initialization error:', error);
      toast({
        title: 'Bank Transfer Failed',
        description: error instanceof Error ? error.message : 'Failed to initialize bank transfer',
        variant: 'destructive',
      });
      isOrderInFlightRef.current = false;
    } finally {
      setIsProcessing(false);
      setIsInitializingDva(false);
    }
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
      ? payForMeDetails.name && payForMeDetails.contact
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




  // Chain display names and explorer URLs
  const chainDisplayNames: Record<string, string> = {
    TRX: 'Tron (TRC-20)',
    ETH: 'Ethereum (ERC-20)',
    MATIC: 'Polygon',
    AVAXC: 'Avalanche C-Chain',
  };

  const chainExplorerUrls: Record<string, string> = {
    TRX: 'https://tronscan.org/#/address/',
    ETH: 'https://etherscan.io/address/',
    MATIC: 'https://polygonscan.com/address/',
    AVAXC: 'https://snowtrace.io/address/',
  };

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
      {showCryptoSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-[var(--store-primary)] to-[var(--store-primary)]/80 p-4 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <CreditCard size={16} className="text-white" />
                </div>
                <h2 className="font-bold text-white">Select Crypto Payment</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCryptoSelector(false);
                  setPendingCryptoOrder(null);
                  isOrderInFlightRef.current = false;
                }}
                className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Currency Selection */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-gray-700">Select Stablecoin</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleCryptoCurrencyChange('USDT')}
                    className={`p-4 rounded-xl border-2 transition-all ${selectedCryptoCurrency === 'USDT'
                      ? 'border-red-500 bg-[var(--store-primary)]/5'
                      : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <div className="text-center">
                      <p className="text-lg font-bold text-gray-900">USDT</p>
                      <p className="text-xs text-gray-500">Tether USD</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCryptoCurrencyChange('USDC')}
                    className={`p-4 rounded-xl border-2 transition-all ${selectedCryptoCurrency === 'USDC'
                      ? 'border-red-500 bg-[var(--store-primary)]/5'
                      : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <div className="text-center">
                      <p className="text-lg font-bold text-gray-900">USDC</p>
                      <p className="text-xs text-gray-500">USD Coin</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Network Selection */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-gray-700">Select Network</label>
                <div className="grid grid-cols-2 gap-3">
                  {cryptoChainSupport[selectedCryptoCurrency].map((chain) => (
                    <button
                      key={chain}
                      type="button"
                      onClick={() => setSelectedCryptoChain(chain)}
                      className={`p-4 rounded-xl border-2 transition-all ${selectedCryptoChain === chain
                        ? 'border-red-500 bg-[var(--store-primary)]/5'
                        : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      <div className="text-center">
                        <p className="text-lg font-bold text-gray-900">{chain}</p>
                        <p className="text-xs text-gray-500">
                          {chainDisplayNames[chain]?.replace(` (${chain === 'TRX' ? 'TRC-20' : 'ERC-20'})`, '') || chain}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Network Info */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Clock size={18} className="text-gray-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedCryptoChain === 'TRX' && '1-3 minutes'}
                      {selectedCryptoChain === 'ETH' && '5-30 minutes'}
                      {selectedCryptoChain === 'MATIC' && '1-5 minutes'}
                      {selectedCryptoChain === 'AVAXC' && '1-5 minutes'}
                    </p>
                    <p className="text-xs text-gray-500">Expected confirmation time</p>
                  </div>
                </div>
              </div>

              {/* Continue Button */}
              <button
                type="button"
                onClick={initializeCryptoPayment}
                disabled={isInitializingCrypto}
                className="w-full py-3.5 bg-[var(--store-primary)] text-white font-bold rounded-xl hover:bg-[var(--store-primary)]/90 transition-colors shadow-lg shadow-[var(--store-primary)]/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isInitializingCrypto ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Generating Address...
                  </>
                ) : (
                  <>
                    Continue with {selectedCryptoCurrency} on {selectedCryptoChain}
                  </>
                )}
              </button>

              <p className="text-center text-xs text-gray-400">
                You'll receive a wallet address to send your {selectedCryptoCurrency} payment
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Crypto Payment Modal */}
      {cryptoPaymentData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-[var(--store-primary)] to-[var(--store-primary)]/80 p-4 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <CreditCard size={16} className="text-white" />
                </div>
                <h2 className="font-bold text-white">Pay with Crypto</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  // Just close the modal - don't clear cart or redirect
                  // User can retry or choose a different payment method
                  setCryptoPaymentData(null);
                  setCryptoVerificationStatus('idle');
                  setIsVerifyingCrypto(false);
                }}
                className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              {/* Top Row: QR & Amount */}
              <div className="flex gap-4 items-center">
                {/* QR Code (Compact) */}
                <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200">
                  <img
                    src={cryptoPaymentData.qrcode || `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${cryptoPaymentData.address}&margin=10`}
                    alt="Scan"
                    className="w-24 h-24"
                    loading="lazy"
                  />
                </div>

                {/* Payment Details */}
                <div className="flex-1 space-y-2">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Send Exactly</p>
                    <p className="text-2xl font-black text-gray-900 leading-tight">
                      {cryptoPaymentData.amount.toLocaleString()} <span className="text-[var(--store-primary)]">{cryptoPaymentData.currency}</span>
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-100 border border-gray-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <p className="text-xs font-semibold text-gray-700">
                      Network: {chainDisplayNames[cryptoPaymentData.chain] || cryptoPaymentData.chain}
                    </p>
                  </div>
                </div>
              </div>

              {/* Wallet Address (Merged Copy) */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">
                  Recipient Address
                </label>
                <div className="relative group">
                  <div className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-3 pr-12 font-mono text-xs text-gray-600 break-all">
                    {cryptoPaymentData.address}
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(cryptoPaymentData.address)}
                    className={`absolute right-1 top-1 bottom-1 px-3 bg-white border rounded-lg shadow-sm transition-all flex items-center justify-center group-hover:shadow-md ${copiedText === cryptoPaymentData.address
                      ? 'border-green-300 text-green-600'
                      : 'border-gray-200 hover:border-[var(--store-primary)]/40 hover:text-[var(--store-primary)]'
                      }`}
                    title={copiedText === cryptoPaymentData.address ? 'Copied!' : 'Copy Address'}
                  >
                    {copiedText === cryptoPaymentData.address ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
              </div>

              {/* Warning (Compact) */}
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                <p className="text-[11px] leading-relaxed text-amber-800">
                  <strong className="font-bold">Warning:</strong> Only send <span className="font-bold">{cryptoPaymentData.currency}</span> on the <span className="font-bold">{chainDisplayNames[cryptoPaymentData.chain] || cryptoPaymentData.chain}</span> network. Using the wrong network will result in permanent loss.
                </p>
              </div>

              {/* Confirmation Time */}
              <div className="flex items-center gap-3 bg-[var(--store-primary)]/5 rounded-xl p-4 border border-[var(--store-primary)]/20">
                <div className="w-10 h-10 bg-[var(--store-primary)]/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <Clock size={20} className="text-[var(--store-primary)]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Expected confirmation</p>
                  <p className="text-xs text-gray-500">{cryptoPaymentData.confirmation_time}</p>
                </div>
              </div>

              {/* Reference */}
              <div className="text-center text-xs text-gray-400">
                Reference: {cryptoPaymentData.reference}
              </div>

              {/* Verification Status */}
              {isVerifyingCrypto && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Loader2 size={18} className="animate-spin text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">
                      {cryptoVerificationStatus === 'checking' && 'Checking payment status...'}
                      {cryptoVerificationStatus === 'pending' && 'Waiting for blockchain confirmation...'}
                    </span>
                  </div>
                  <p className="text-xs text-blue-600">
                    This may take a few minutes. Do not close this window.
                  </p>
                </div>
              )}

              {cryptoVerificationStatus === 'confirmed' && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                  <p className="text-sm font-medium text-green-800">
                    Payment confirmed! Redirecting to order confirmation...
                  </p>
                </div>
              )}

              {cryptoVerificationStatus === 'failed' && (
                <div className="bg-[var(--store-primary)]/5 border border-[var(--store-primary)]/30 rounded-xl p-4 text-center">
                  <p className="text-sm font-medium text-red-800">
                    Payment verification failed. Please contact support.
                  </p>
                </div>
              )}

              {/* Verify Payment Button */}
              <button
                type="button"
                onClick={verifyCryptoPayment}
                disabled={isVerifyingCrypto}
                className={`w-full py-3.5 font-bold rounded-xl transition-colors shadow-lg ${isVerifyingCrypto
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  : 'bg-[var(--store-primary)] text-white hover:bg-[var(--store-primary)]/90 shadow-[var(--store-primary)]/20'
                  }`}
              >
                {isVerifyingCrypto ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={18} className="animate-spin" />
                    Verifying Payment...
                  </span>
                ) : (
                  "I've Sent the Payment"
                )}
              </button>

              <p className="text-center text-xs text-gray-400">
                Click the button above after sending. We'll verify the payment on the blockchain.
              </p>

              {/* Close without verifying */}
              {!isVerifyingCrypto && (
                <button
                  type="button"
                  onClick={() => {
                    const confirmed = confirm(
                      'Are you sure you want to close? If you\'ve already sent payment, your order will still be processed once the payment is detected.'
                    );
                    if (confirmed) {
                      setCryptoPaymentData(null);
                      setCryptoVerificationStatus('idle');
                    }
                  }}
                  className="w-full py-2.5 text-gray-500 text-sm font-medium hover:text-gray-700 transition-colors"
                >
                  Close and check order status later
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Virtual Account (DVA) Modal */}
      {dvaData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-[var(--store-primary)] to-[var(--store-primary)]/80 p-6 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Building2 size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-white leading-none">Bank Transfer</h2>
                  <p className="text-white/70 text-xs mt-1">Automatic verification</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDvaData(null)}
                className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Amount to Pay */}
              <div className="text-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Send Exactly</p>
                <p className="text-3xl font-black text-gray-900">
                  ₦{dvaData.amount.toLocaleString()}
                </p>
              </div>

              {/* Bank Details */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">
                    Account Number
                  </label>
                  <div className="relative group">
                    <div className="w-full bg-gray-50 border border-gray-200 rounded-xl py-4 px-4 font-mono text-xl font-bold text-gray-900 tracking-wider">
                      {dvaData.account_number}
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(dvaData.account_number)}
                      className={`absolute right-2 top-2 bottom-2 px-4 bg-white border rounded-lg shadow-sm transition-all flex items-center justify-center group-hover:shadow-md ${copiedText === dvaData.account_number
                        ? 'border-green-300 text-green-600'
                        : 'border-gray-200 hover:border-[var(--store-primary)]/40 hover:text-[var(--store-primary)]'
                        }`}
                    >
                      {copiedText === dvaData.account_number ? <Check size={18} /> : <Copy size={18} />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Bank Name</p>
                    <p className="font-bold text-gray-900">{dvaData.bank_name}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Account Name</p>
                    <p className="font-bold text-gray-900 truncate">{dvaData.account_name}</p>
                  </div>
                </div>
              </div>

              {/* Instruction & Timer */}
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-4">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
                  <Clock size={20} className="text-blue-600" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-blue-900">Transfer expires in 60:00</h4>
                  <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                    Make your transfer within the next hour. Your order will be confirmed automatically once the payment is detected.
                  </p>
                </div>
              </div>

              {/* Waiting Status */}
              <div className="flex flex-col items-center justify-center py-4 gap-3">
                <div className="flex items-center gap-3 text-[var(--store-primary)]">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-[var(--store-primary)] rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-1.5 h-1.5 bg-[var(--store-primary)] rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-1.5 h-1.5 bg-[var(--store-primary)] rounded-full animate-bounce" />
                  </div>
                  <span className="text-sm font-bold">Waiting for transfer...</span>
                </div>
                <p className="text-[10px] text-gray-400 text-center">
                  Reference: {dvaData.reference}
                </p>
              </div>

              {/* Buttons */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="w-full py-4 bg-[var(--store-primary)] text-white font-bold rounded-xl hover:bg-[var(--store-primary)]/90 transition-colors shadow-lg shadow-[var(--store-primary)]/20"
                >
                  Confirm Transfer Sent
                </button>
                <button
                  type="button"
                  onClick={() => setDvaData(null)}
                  className="w-full py-2.5 text-gray-500 text-sm font-medium hover:text-gray-700 transition-colors"
                >
                  Close and check later
                </button>
              </div>
            </div>
          </div>
        </div>
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

            {/* Accordion Step 1: Contact Information */}
            <div className={`bg-white rounded-2xl shadow-sm border ${currentStep === 'contact' ? 'border-[var(--store-primary)] ring-1 ring-[var(--store-primary)]/20' : 'border-gray-100'} overflow-hidden transition-all duration-300`}>
              <button
                type="button"
                onClick={() => setCurrentStep('contact')}
                className="w-full px-6 py-4 flex items-center justify-between text-left"
              >
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-colors ${completedSteps.contact ? 'bg-green-100 text-green-600' : currentStep === 'contact' ? 'bg-[var(--store-primary)]/10 text-[var(--store-primary)]' : 'bg-gray-100 text-gray-500'
                    }`}>
                    {completedSteps.contact ? <Check size={14} /> : '1'}
                  </div>
                  Contact Information
                </h2>
                {completedSteps.contact && currentStep !== 'contact' && (
                  <span className="text-sm font-medium text-[var(--store-primary)] hover:text-[var(--store-primary)]">Edit</span>
                )}
              </button>

              {/* Collapsible Content */}
              <div className={`grid transition-all duration-300 ease-in-out ${currentStep === 'contact' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                  <div className="p-6 pt-0 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                          First Name *
                        </label>
                        <input
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="John"
                          className={`w-full px-4 py-3 bg-gray-50 border rounded-xl focus:outline-none text-sm text-gray-900 placeholder:text-gray-400 ${contactValidationAttempted && !firstName.trim()
                            ? 'border-red-500 focus:border-red-500 bg-[var(--store-primary)]/5'
                            : 'border-gray-200 focus:border-red-500'
                            }`}
                          required
                        />
                        {contactValidationAttempted && !firstName.trim() && (
                          <p className="text-red-500 text-xs mt-1">First name is required</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                          Last Name *
                        </label>
                        <input
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Doe"
                          className={`w-full px-4 py-3 bg-gray-50 border rounded-xl focus:outline-none text-sm text-gray-900 placeholder:text-gray-400 ${contactValidationAttempted && !lastName.trim()
                            ? 'border-red-500 focus:border-red-500 bg-[var(--store-primary)]/5'
                            : 'border-gray-200 focus:border-red-500'
                            }`}
                          required
                        />
                        {contactValidationAttempted && !lastName.trim() && (
                          <p className="text-red-500 text-xs mt-1">Last name is required</p>
                        )}
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                          Email Address *
                        </label>
                        <input
                          type="email"
                          value={customerEmail}
                          onChange={(e) => setCustomerEmail(e.target.value)}
                          placeholder="john@example.com"
                          className={`w-full px-4 py-3 bg-gray-50 border rounded-xl focus:outline-none text-sm text-gray-900 placeholder:text-gray-400 ${contactValidationAttempted && (!customerEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim()))
                            ? 'border-red-500 focus:border-red-500 bg-[var(--store-primary)]/5'
                            : 'border-gray-200 focus:border-red-500'
                            }`}
                          required
                        />
                        {contactValidationAttempted && !customerEmail.trim() && (
                          <p className="text-red-500 text-xs mt-1">Email address is required</p>
                        )}
                        {contactValidationAttempted && customerEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim()) && (
                          <p className="text-red-500 text-xs mt-1">Please enter a valid email address</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                        Phone Number *
                      </label>
                      <div className={contactValidationAttempted && (!customerPhone || !isValidPhoneNumber(customerPhone)) ? "rounded-lg border border-red-500" : ""}>
                        <PhoneInput
                          value={customerPhone}
                          onChange={(value) => setCustomerPhone(value || '')}
                          placeholder="+234 800 000 0000"
                          defaultCountry="NG"
                          className="w-full text-sm"
                        />
                      </div>
                      {contactValidationAttempted && !customerPhone && (
                        <p className="text-red-500 text-xs mt-1">Phone number is required</p>
                      )}
                      {contactValidationAttempted && customerPhone && !isValidPhoneNumber(customerPhone) && (
                        <p className="text-red-500 text-xs mt-1">Please enter a valid phone number</p>
                      )}
                    </div>

                    {/* Guest Account Creation & Newsletter (2026 Conversion Pattern) */}
                    {!user && (
                      <div className="md:col-span-2 space-y-4 pt-4">

                        {/* 2. Account Creation Checkbox (Retention) */}
                        <div className={`bg-gray-50 rounded-xl p-4 border transition-all duration-300 ${createAccount ? 'border-[var(--store-primary)]/30 bg-[var(--store-primary)]/5' : 'border-gray-100 hover:border-[var(--store-primary)]/20'}`}>
                          <label className="flex items-start gap-3 cursor-pointer group mb-2">
                            <div className="relative flex items-center pt-0.5">
                              <input
                                type="checkbox"
                                checked={createAccount}
                                onChange={(e) => {
                                  setCreateAccount(e.target.checked);
                                  setShowPasswordInput(e.target.checked);
                                }}
                                className="peer h-5 w-5 rounded border-gray-300 text-[var(--store-primary)] focus:ring-[var(--store-primary)]"
                              />
                            </div>
                            <div>
                              <span className="block text-sm font-bold text-gray-900 group-hover:text-[var(--store-primary)] transition-colors">
                                Save my information for a faster checkout next time
                              </span>
                              <span className="text-xs text-gray-500 mt-0.5 block">
                                Securely save your address details for future orders.
                              </span>
                            </div>
                          </label>

                          {/* 3. Sliding Password Input */}
                          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showPasswordInput ? 'max-h-24 opacity-100 mt-3 pl-8' : 'max-h-0 opacity-0'}`}>
                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                              Create a Password
                            </label>
                            <div className="relative">
                              <input
                                type={isPasswordVisible ? "text" : "password"}
                                value={accountPassword}
                                onChange={(e) => setAccountPassword(e.target.value)}
                                placeholder="Min. 6 characters"
                                className={`w-full px-4 py-3 bg-white border rounded-xl focus:outline-none text-sm text-gray-900 placeholder:text-gray-400 pr-12 ${contactValidationAttempted && createAccount && accountPassword.length < 6
                                  ? 'border-red-500 focus:border-red-500'
                                  : 'border-gray-200 focus:border-[var(--store-primary)]'
                                  }`}
                              />
                              <button
                                type="button"
                                onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                              >
                                {isPasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                              </button>
                            </div>
                            {contactValidationAttempted && createAccount && accountPassword.length < 6 && (
                              <p className="text-red-500 text-xs mt-1">Password must be at least 6 characters</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCompletedSteps(prev => ({ ...prev, contact: true }));
                          setCurrentStep('delivery');
                        }}
                        disabled={!isContactValid || (createAccount && accountPassword.length < 6)}
                        className="px-6 py-3 bg-[var(--store-primary)] text-white font-bold rounded-xl hover:bg-[var(--store-primary)]/90 transition-colors w-full md:w-auto disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed shadow-lg disabled:shadow-none"
                      >
                        Continue to Delivery
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Delivery Method */}
            <div className={`bg-white rounded-2xl shadow-sm border ${currentStep === 'delivery' ? 'border-[var(--store-primary)] ring-1 ring-[var(--store-primary)]/20' : 'border-gray-100'} transition-all duration-300`}>
              <button
                type="button"
                onClick={() => completedSteps.contact && setCurrentStep('delivery')}
                disabled={!completedSteps.contact}
                className="w-full px-6 py-4 flex items-center justify-between text-left disabled:opacity-50 disabled:cursor-not-allowed hidden-disabled"
              >
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-colors ${completedSteps.delivery ? 'bg-green-100 text-green-600' : currentStep === 'delivery' ? 'bg-[var(--store-primary)]/10 text-[var(--store-primary)]' : 'bg-gray-100 text-gray-500'
                    }`}>
                    {completedSteps.delivery ? <Check size={14} /> : '2'}
                  </div>
                  Delivery Method
                </h2>
                {completedSteps.delivery && currentStep !== 'delivery' && (
                  <span className="text-sm font-medium text-[var(--store-primary)] hover:text-[var(--store-primary)]">Edit</span>
                )}
              </button>

              <div className={`grid transition-all duration-300 ease-in-out ${currentStep === 'delivery' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className={currentStep === 'delivery' ? 'overflow-visible' : 'overflow-hidden'}>
                  <div className="p-6 pt-0 space-y-4">
                    {/* STEP 1: Address Input FIRST */}
                    <div className="space-y-4">
                      {/* Saved Addresses (for logged in users) */}
                      {user && addresses.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                              Where should we deliver?
                            </label>
                            <button
                              onClick={() => setIsNewAddressMode(!isNewAddressMode)}
                              className="text-xs font-bold text-[var(--store-primary)] hover:underline"
                            >
                              {isNewAddressMode ? 'Select Saved Address' : '+ New Address'}
                            </button>
                          </div>
                          {!isNewAddressMode && addresses.map((addr) => (
                            <label
                              key={addr.id}
                              className={`flex items-start p-4 rounded-xl border cursor-pointer transition-all ${selectedAddressId === addr.id
                                ? 'border-[var(--store-primary)] bg-[var(--store-primary)]/5'
                                : 'border-gray-200 hover:border-gray-300'
                                }`}
                            >
                              <input
                                type="radio"
                                name="address"
                                checked={selectedAddressId === addr.id}
                                onChange={() => {
                                  setSelectedAddressId(addr.id);
                                  setIsNewAddressMode(false);
                                  // Extract state from saved address for eligibility checks
                                  const parts = addr.address.split(',').map(s => s.trim());
                                  if (parts.length >= 2) {
                                    setNewAddressState(parts[parts.length - 1] || '');
                                    setNewAddressCity(parts[parts.length - 2] || '');
                                  }
                                }}
                                className="mt-1 w-4 h-4 text-[var(--store-primary)] focus:ring-[var(--store-primary)] border-gray-300"
                              />
                              <div className="ml-3">
                                <p className="font-bold text-gray-900 text-sm">
                                  {addr.label || 'Saved Address'}
                                </p>
                                <p className="text-gray-600 text-sm mt-0.5">
                                  {addr.address}
                                </p>
                                <p className="text-gray-500 text-xs mt-1">
                                  {addr.phone}
                                </p>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}

                      {/* New Address Form */}
                      {(isNewAddressMode || !user || addresses.length === 0) && (
                        <div className="space-y-4" style={{ overflow: 'visible' }}>
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
                            {user && addresses.length > 0 ? 'Enter New Address' : 'Delivery Address'}
                          </label>
                          <AddressAutocomplete
                            value={newAddressStreet}
                            useThemedInput={true}
                            onChange={(val) => {
                              const newVal = typeof val === 'string' ? val : val.target.value;
                              setNewAddressStreet(newVal);

                              // Reset state/city if address is cleared or changed significantly
                              if (!newVal || newVal.length < 10) {
                                setNewAddressState('');
                                setNewAddressCity('');
                                setShippingQuotes([]);
                                setSelectedQuoteId('');
                                setDeliveryMethod('door'); // Reset to default
                              }
                            }}
                            onSelect={(place: any) => {
                              setNewAddressStreet(place.formattedAddress);
                              if (place.state) {
                                setNewAddressState(place.state);
                              }
                              if (place.city) {
                                setNewAddressCity(place.city);
                              }
                            }}
                            placeholder="Start typing your address..."
                            country="NG"
                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus-visible:ring-0 focus:border-red-500 text-sm text-gray-900 placeholder:text-gray-400"
                          />
                          {isHydrated && newAddressState && newAddressCity && (
                            <p className="text-xs text-green-600 flex items-center gap-1">
                              <Check size={12} /> Detected: {newAddressCity}, {newAddressState}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* STEP 2: Delivery Method Cards - ONLY show AFTER address is detected */}
                    {isHydrated && ((newAddressState && newAddressCity) || (!isNewAddressMode && selectedAddressId)) && (
                      <>
                        <div className="mt-6 pt-4 border-t border-gray-100">
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">
                            How would you like to receive your order?
                          </label>
                          <div className="flex gap-3 overflow-x-auto pb-1">
                            {(['door', 'pickup', 'airport'] as const).map((method) => {
                              // Filter out Pickup if not in Lagos (store is in Lagos)
                              if (method === 'pickup') {
                                const currentState = newAddressState;
                                const isLagos = currentState && currentState.toLowerCase() === 'lagos';
                                if (!isLagos) return null;
                              }

                              // Filter out Airport if not eligible (non-Lagos states only)
                              if (method === 'airport') {
                                const AIRPORT_STATES = [
                                  'Abuja', 'FCT', 'Federal Capital Territory', 'FCT - Abuja',
                                  'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
                                  'Borno', 'Cross River', 'Delta', 'Edo', 'Enugu', 'Gombe',
                                  'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi',
                                  'Kwara', 'Niger', 'Ondo', 'Oyo', 'Plateau', 'Rivers',
                                  'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
                                ];
                                const currentState = newAddressState;
                                const isEligible = currentState && AIRPORT_STATES.some(s => s.toLowerCase() === currentState.toLowerCase()) && currentState.toLowerCase() !== 'lagos';
                                if (!isEligible) return null;
                              }

                              const Icon = method === 'door' ? Truck : method === 'pickup' ? Building2 : Plane;
                              const label = method === 'door' ? 'Door Delivery' : method === 'pickup' ? 'Pickup' : 'Airport';
                              const subtitle = method === 'door' ? 'To your address' : method === 'pickup' ? 'Collect at store' : 'Via air cargo';

                              return (
                                <button
                                  key={method}
                                  onClick={() => setDeliveryMethod(method)}
                                  className={`flex-1 flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl border-2 transition-all gap-1 min-w-[100px] ${deliveryMethod === method
                                    ? 'border-[var(--store-primary)] bg-[var(--store-primary)]/5 text-[var(--store-primary)]'
                                    : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200 hover:bg-gray-50'
                                    }`}
                                >
                                  <Icon className={`w-6 h-6 ${deliveryMethod === method ? 'text-[var(--store-primary)]' : 'text-gray-400'}`} />
                                  <span className="text-xs sm:text-sm font-bold">{label}</span>
                                  <span className="text-[10px] text-gray-400">{subtitle}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* STEP 3: Delivery Method Details */}
                        {/* Pickup Info */}
                        {deliveryMethod === 'pickup' && (
                          <div className="mt-4 bg-gray-50 p-4 rounded-xl border border-gray-100 flex items-start gap-4 animate-in fade-in">
                            <div className="bg-white p-2 rounded-lg border border-gray-200">
                              <Building2 size={24} className="text-gray-600" />
                            </div>
                            <div>
                              <h4 className="font-bold text-gray-900 text-sm">Main Office Pickup</h4>
                              <p className="text-sm text-gray-600 mt-1">
                                Available for pickup at our Ikeja Store. Usually ready within 2 hours.
                              </p>
                              <div className="mt-2 text-xs font-mono bg-white inline-block px-2 py-1 rounded border border-gray-200 text-gray-500">
                                Pickup closes at 6 PM
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Airport Options */}
                        {deliveryMethod === 'airport' && (
                          <div className="mt-4 space-y-3 animate-in fade-in">
                            <div className="flex items-start gap-3">
                              <Plane size={20} className="text-gray-500 mt-0.5" />
                              <p className="text-sm text-gray-600">
                                Delivery to your nearest airport. Choose delivery to your location or pickup at the airport.
                              </p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <label
                                className={`relative flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${airportType === 'delivery'
                                  ? 'border-[var(--store-primary)] bg-[var(--store-primary)]/5'
                                  : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                                  }`}
                              >
                                <input
                                  type="radio"
                                  name="airportType"
                                  value="delivery"
                                  checked={airportType === 'delivery'}
                                  onChange={() => setAirportType('delivery')}
                                  className="sr-only"
                                />
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${airportType === 'delivery' ? 'border-[var(--store-primary)]' : 'border-gray-400'
                                  }`}>
                                  {airportType === 'delivery' && (
                                    <div className="w-2.5 h-2.5 rounded-full bg-[var(--store-primary)]" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <p className="font-bold text-gray-900 text-sm">Airport Delivery</p>
                                  <p className="text-xs text-gray-500 mt-0.5">Delivered to your address</p>
                                </div>
                                <span className="font-bold text-gray-900">₦25,000</span>
                              </label>
                              <label
                                className={`relative flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${airportType === 'pickup'
                                  ? 'border-[var(--store-primary)] bg-[var(--store-primary)]/5'
                                  : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                                  }`}
                              >
                                <input
                                  type="radio"
                                  name="airportType"
                                  value="pickup"
                                  checked={airportType === 'pickup'}
                                  onChange={() => setAirportType('pickup')}
                                  className="sr-only"
                                />
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${airportType === 'pickup' ? 'border-[var(--store-primary)]' : 'border-gray-400'
                                  }`}>
                                  {airportType === 'pickup' && (
                                    <div className="w-2.5 h-2.5 rounded-full bg-[var(--store-primary)]" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <p className="font-bold text-gray-900 text-sm">Airport Pickup</p>
                                  <p className="text-xs text-gray-500 mt-0.5">Collect at the airport</p>
                                </div>
                                <span className="font-bold text-gray-900">₦20,000</span>
                              </label>
                            </div>
                          </div>
                        )}

                        {/* Door Delivery - Quote Selector */}
                        {deliveryMethod === 'door' && (
                          <div className="mt-6 border-t border-gray-100 pt-4">
                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">
                              Select Delivery Option
                            </label>

                            {isLoadingQuotes ? (
                              <SmartQuoteLoader />
                            ) : shippingQuotes.length > 0 ? (
                              <div className="space-y-3">
                                {shippingQuotes.map((quote) => (
                                  <label
                                    key={quote.id}
                                    className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer hover:border-[var(--store-primary)]/60 transition-all ${selectedQuoteId === quote.id
                                      ? 'border-red-500 bg-[var(--store-primary)]/5 ring-1 ring-[var(--store-primary)]'
                                      : 'border-gray-100 bg-white'
                                      }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <input
                                        type="radio"
                                        name="shipping_quote"
                                        checked={selectedQuoteId === quote.id}
                                        onChange={() => setSelectedQuoteId(quote.id)}
                                        className="w-4 h-4 text-[var(--store-primary)] focus:ring-[var(--store-primary)] border-gray-300"
                                      />
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm font-bold text-gray-900">{quote.displayName}</span>
                                          {quote.carrierName.includes('GIG') && <span className="text-[10px] bg-black text-white px-1.5 py-0.5 rounded font-bold">GIGL</span>}
                                          {quote.carrierName.includes('Topship') && <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold">Best Value</span>}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                          Est. Delivery: {(quote as any).deliveryRange || `${quote.estimatedDays} days`}
                                        </p>
                                      </div>
                                    </div>
                                    <span className="font-bold text-sm text-gray-900">
                                      ₦{quote.price.toLocaleString()}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  if (newAddressState && newAddressCity) {
                                    fetchShippingQuotes(
                                      newAddressStreet || `${newAddressCity}, ${newAddressState}`,
                                      newAddressState,
                                      newAddressCity,
                                      customerPhone,
                                      firstName,
                                      lastName,
                                      customerEmail
                                    );
                                  }
                                }}
                                className="w-full bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-dashed border-amber-300 rounded-xl p-5 flex flex-col items-center gap-3 hover:border-amber-400 hover:shadow-md transition-all group cursor-pointer"
                              >
                                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
                                  <Truck size={24} />
                                </div>
                                <div className="text-center">
                                  <h4 className="text-sm font-bold text-gray-900">🚚 Oops! Rates took a detour</h4>
                                  <p className="text-xs text-amber-700 mt-1">
                                    Our delivery partners are a bit slow today. Tap here to try again!
                                  </p>
                                </div>
                                <span className="text-xs font-bold text-amber-600 bg-amber-100 px-3 py-1 rounded-full group-hover:bg-amber-200 transition-colors">
                                  ↻ Refresh Rates
                                </span>
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    )}

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCompletedSteps(prev => ({ ...prev, delivery: true }));
                          setCurrentStep('payment');
                        }}
                        className="w-full md:w-auto px-6 py-3 bg-[var(--store-primary)] text-white font-bold rounded-xl hover:bg-[var(--store-primary)]/90 transition-colors flex items-center justify-center gap-2 shadow-lg hover:shadow-[var(--store-primary)]/20 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed disabled:shadow-none"
                        disabled={!isDeliveryValid}
                      >
                        Continue to Payment
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3: Payment Method */}
            <div className={`bg-white rounded-2xl shadow-sm border ${currentStep === 'payment' ? 'border-[var(--store-primary)] ring-1 ring-[var(--store-primary)]/20' : 'border-gray-100'} overflow-hidden transition-all duration-300`}>
              <button
                type="button"
                onClick={() => completedSteps.delivery && setCurrentStep('payment')}
                disabled={!completedSteps.delivery}
                className="w-full px-6 py-4 flex items-center justify-between text-left disabled:opacity-50 disabled:cursor-not-allowed hidden-disabled"
              >
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-colors ${paymentMethod ? 'bg-green-100 text-green-600' : currentStep === 'payment' ? 'bg-[var(--store-primary)]/10 text-[var(--store-primary)]' : 'bg-gray-100 text-gray-500'
                    }`}>
                    {paymentMethod ? <Check size={14} /> : '3'}
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
                                ? 'border-[var(--store-primary)] bg-[var(--store-primary)]/5'
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
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'paystack' ? 'border-[var(--store-primary)]' : 'border-gray-400'}`}>
                                {paymentMethod === 'paystack' && <div className="w-2.5 h-2.5 rounded-full bg-[var(--store-primary)]" />}
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
                                ? 'border-[var(--store-primary)] bg-[var(--store-primary)]/5'
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
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'bank_transfer' ? 'border-[var(--store-primary)]' : 'border-gray-400'}`}>
                                {paymentMethod === 'bank_transfer' && <div className="w-2.5 h-2.5 rounded-full bg-[var(--store-primary)]" />}
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
                              ? 'border-[var(--store-primary)] bg-[var(--store-primary)]/5'
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
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'korapay' ? 'border-[var(--store-primary)]' : 'border-gray-400'}`}>
                              {paymentMethod === 'korapay' && <div className="w-2.5 h-2.5 rounded-full bg-[var(--store-primary)]" />}
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
                                ? 'border-[var(--store-primary)] bg-[var(--store-primary)]/5'
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
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'juicyway' ? 'border-[var(--store-primary)]' : 'border-gray-400'}`}>
                                {paymentMethod === 'juicyway' && <div className="w-2.5 h-2.5 rounded-full bg-[var(--store-primary)]" />}
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
                                ? 'border-[var(--store-primary)] bg-[var(--store-primary)]/5'
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
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'pod' ? 'border-[var(--store-primary)]' : 'border-gray-400'}`}>
                                {paymentMethod === 'pod' && <div className="w-2.5 h-2.5 rounded-full bg-[var(--store-primary)]" />}
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
                                ? 'border-[var(--store-primary)] bg-[var(--store-primary)]/5'
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
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'credpal' ? 'border-[var(--store-primary)]' : 'border-gray-400'}`}>
                                {paymentMethod === 'credpal' && <div className="w-2.5 h-2.5 rounded-full bg-[var(--store-primary)]" />}
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
                                ? 'border-[var(--store-primary)] bg-[var(--store-primary)]/5'
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
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'credit_direct' ? 'border-[var(--store-primary)]' : 'border-gray-400'}`}>
                                {paymentMethod === 'credit_direct' && <div className="w-2.5 h-2.5 rounded-full bg-[var(--store-primary)]" />}
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
                              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <CreditCard size={16} className="text-blue-600" />
                              </div>
                              <div>
                                <h4 className="font-bold text-sm text-gray-900">How CredPal works</h4>
                                <ul className="mt-2 space-y-1 text-xs text-gray-600">
                                  <li>• Quick approval in minutes</li>
                                  <li>• Pay over 3-6 months</li>
                                  <li>• Competitive interest rates</li>
                                  <li>• Receive your items immediately</li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Credit Direct Info */}
                        {paymentMethod === 'credit_direct' && (
                          <div className="p-4 bg-purple-50 rounded-xl border border-purple-100 animate-in slide-in-from-top-2">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <CreditCard size={16} className="text-purple-600" />
                              </div>
                              <div>
                                <h4 className="font-bold text-sm text-gray-900">How Credit Direct works</h4>
                                <ul className="mt-2 space-y-1 text-xs text-gray-600">
                                  <li>• Instant approval decision</li>
                                  <li>• Pay over 3-6 months</li>
                                  <li>• No hidden fees</li>
                                  <li>• Get your items immediately</li>
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
                            className="peer h-4 w-4 rounded border-gray-300 text-[var(--store-primary)] focus:ring-[var(--store-primary)]"
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
                        (remainingAmount > 0 && !paymentMethod) ||
                        (paymentMethod === 'payforme' && !isPayForMeValid)
                      }
                      className="w-full bg-[var(--store-primary)] hover:bg-[var(--store-primary)]/90 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-[var(--store-primary)]/20 active:scale-[0.98]"
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

          </div>

          {/* RIGHT COLUMN: Order Summary */}
          <div className="hidden lg:block lg:col-span-4 lg:sticky lg:top-24 space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                Order Summary
              </h2>

              {/* Items List (Collapsed View) */}
              <div className="space-y-4 mb-6 max-h-[200px] overflow-y-auto pr-1">
                {(cart.length > 0 ? cart : (resumedOrder?.items || [])).map((item: any) => (
                  <div key={item.cartItemId || item.id} className="flex gap-3">
                    <div className="w-12 h-12 bg-gray-50 rounded-lg border border-gray-100 p-1 flex-shrink-0">
                      <img
                        src={item.image || item.image_url || '/placeholder.png'}
                        alt={item.name || item.product_name}
                        className="w-full h-full object-contain mix-blend-multiply"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = '/placeholder.png';
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 line-clamp-1">
                        {item.name || item.product_name}
                      </p>
                      <div className="flex justify-between items-center text-xs text-gray-500 mt-0.5">
                        <span>Qty: {item.quantity}</span>
                        <span>
                          ₦
                          {(
                            item.negotiatedPrice || item.price
                          ).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-gray-200 my-4" />

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-gray-600 text-sm">
                  <span>Subtotal</span>
                  <span>₦{cartTotal.toLocaleString()}</span>
                </div>
                {orderTotals && (
                  <div className="flex justify-between text-gray-600 text-sm">
                    <span>VAT (7.5%)</span>
                    <span>₦{orderTotals.taxAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-600 text-sm">
                  <span>Delivery</span>
                  <span
                    className={
                      deliveryCost === 0
                        ? 'text-green-600 font-bold'
                        : 'text-gray-900'
                    }
                  >
                    {deliveryMethod === 'door' && !selectedQuoteId && deliveryCost === 0
                      ? <span className="text-gray-500 font-normal italic">Calculated...</span>
                      : deliveryCost === 0 ? 'Free' : `₦${deliveryCost.toLocaleString()}`}
                  </span>
                </div>
                {giftWrappingCost > 0 && (
                  <div className="flex justify-between text-gray-600 text-sm">
                    <span>Gift Wrapping</span>
                    <span>₦{giftWrappingCost.toLocaleString()}</span>
                  </div>
                )}

                {/* Wallet Credit Section (2025: progressive disclosure - only show if balance > 0 or loading) */}
                {(walletLoading || walletBalance > 0) && user && (
                  <div className="py-2 animate-in fade-in">
                    {walletLoading ? (
                      <div className="flex items-center gap-2 text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Checking wallet balance...</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                              <span className="text-green-600 text-xs font-bold">₦</span>
                            </div>
                            <div>
                              <span className="text-sm font-medium text-gray-700">Wallet Credit</span>
                              <span className="text-xs text-gray-500 ml-1">(₦{walletBalance.toLocaleString()} available)</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPayWithWallet(!payWithWallet)}
                            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${payWithWallet ? 'bg-green-600' : 'bg-gray-300'
                              }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${payWithWallet ? 'translate-x-4' : 'translate-x-0'
                                }`}
                            />
                          </button>
                        </div>
                        {payWithWallet && walletAmountUsed > 0 && (
                          <div className="flex justify-between text-green-700 text-sm font-medium mt-2 pl-8">
                            <span>Applied Credit</span>
                            <span>-₦{walletAmountUsed.toLocaleString()}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                <div className="border-t border-dashed border-gray-200 my-2" />

                {/* Total or Amount Due */}
                <div className="flex justify-between text-gray-900 font-bold text-lg">
                  <span>
                    {remainingAmount > 0 && payWithWallet
                      ? 'Amount Due'
                      : 'Total'}
                  </span>
                  <span>₦{remainingAmount.toLocaleString()}</span>
                </div>
              </div>

              {/* Newsletter Opt-in (Moved to Summary Card) */}
              {!user && (
                <label className="flex items-start gap-3 cursor-pointer group mb-4 px-1">
                  <div className="relative flex items-center pt-0.5">
                    <input
                      id="newsletter-summary-opt-in"
                      type="checkbox"
                      checked={newsletterOptIn}
                      onChange={(e) => setNewsletterOptIn(e.target.checked)}
                      className="peer h-4 w-4 rounded border-gray-300 text-[var(--store-primary)] focus:ring-[var(--store-primary)]"
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
                  (remainingAmount > 0 && !paymentMethod) ||
                  (paymentMethod === 'payforme' && !isPayForMeValid)
                }
                className="hidden lg:flex w-full bg-[var(--store-primary)] hover:bg-[var(--store-primary)]/90 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold py-3.5 px-4 rounded-xl items-center justify-center gap-2 transition-all shadow-lg hover:shadow-[var(--store-primary)]/20 active:scale-[0.98]"
              >
                {isProcessing ? (
                  <Loader2 className="animate-spin" />
                ) : paymentMethod === 'invoice' ? (
                  'Generate Invoice'
                ) : paymentMethod === 'payforme' ? (
                  'Send Payment Link'
                ) : (
                  'Place Order'
                )}
                {!isProcessing && <ChevronRight size={20} />}
              </button>

              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-green-600 font-medium">
                <ShieldCheck size={14} /> Secure Encrypted Payment
              </div>
            </div>
          </div>
        </div>
      </div>

    </div >
  );
};
