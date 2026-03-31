/**
 * Checkout Screen
 * Multi-step checkout: Address -> Payment -> Confirmation
 */

import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { router, Stack } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
  type Control,
  Controller,
  type FieldErrors,
  type Resolver,
  useForm,
} from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CryptoSelectionModal } from '@/components/checkout/CryptoSelectionModal';
import {
  PaymentMethodSelector,
  type PaymentMethodType,
  type PaymentTab,
} from '@/components/checkout/PaymentMethodSelector';
import { AddressAutocomplete } from '@/components/ui/AddressAutocomplete';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, {
  BRAND,
  palette,
  RADIUS,
  SHADOWS,
  SPACING,
} from '@/constants/Colors';
import { useAuthStatus } from '@/hooks/use-auth-guard';
import { type TextContentType, TextContentTypes } from '@/hooks/use-keyboard';
import {
  getEnabledPaymentMethods,
  getMerchantTaxRate,
  useMerchantPaymentSettings,
} from '@/hooks/useMerchantPaymentSettings';
import { setClipboardString } from '@/lib/clipboard';
import { calculateCommerce, supabase } from '@/lib/supabase';
import {
  type ShippingAddressInput,
  ShippingAddressSchema,
} from '@/lib/validation';
import {
  trackCheckoutStarted,
  trackCheckoutStep,
  trackError,
  trackOrderCompleted,
} from '@/services/analytics';
import { createOrder, OrderError, type OrderResponse } from '@/services/orders';
import { scheduleLocalNotification } from '@/services/push-notifications';
import { type Customer, useAuthStore } from '@/stores/auth-store';
import { type CartItem, formatPrice, useCartStore } from '@/stores/cart-store';

type CheckoutStep = 'address' | 'payment' | 'review';

type ThemeColors = (typeof Colors)[keyof typeof Colors];

type TextInputAutoComplete = React.ComponentProps<
  typeof TextInput
>['autoComplete'];

const shippingAddressResolver = zodResolver(
  ShippingAddressSchema as unknown as Parameters<typeof zodResolver>[0]
) as unknown as Resolver<ShippingAddressInput>;

interface ShippingQuote {
  id: string | number;
  displayName: string;
  price: number;
  carrierName?: string;
  provider?: string;
  estimatedDays?: number;
  deliveryRange?: string;
  serviceTier?: string;
  isStationPickup?: boolean;
}

interface QuoteResponse {
  quotes: {
    all: ShippingQuote[];
  };
}

interface ShippingLocation {
  state: string;
  city: string;
}

interface PendingCryptoOrder {
  order: OrderResponse['order'];
  orderResponse: OrderResponse;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  trackingToken?: string;
}

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.apiUrl ||
  'https://ogabassey.usebaci.com';

const MERCHANT_ID =
  Constants.expoConfig?.extra?.merchantId ||
  '6b5cb8a4-5575-456c-b936-8cdfae30db74';

const MERCHANT_SLUG = Constants.expoConfig?.extra?.merchantSlug || 'ogabassey';

const PAYMENT_METHOD_LABELS: Record<PaymentMethodType, string> = {
  paystack: 'Card Payment (Paystack)',
  korapay: 'Card Payment (Korapay)',
  bank_transfer: 'Bank Transfer',
  pay_on_delivery: 'Pay on Delivery',
  credpal: 'CredPal (Buy Now Pay Later)',
  credit_direct: 'Credit Direct (Installments)',
  juicyway: 'Crypto (Juicyway)',
};

const STEP_PILL_LABELS: Record<CheckoutStep, string> = {
  address: 'Delivery',
  payment: 'Payment',
  review: 'Review',
};

const GOOGLE_STATE_ALIASES: Record<string, string> = {
  'federal capital territory': 'FCT - Abuja',
  fct: 'FCT - Abuja',
  abuja: 'FCT - Abuja',
  'lagos state': 'Lagos',
  'rivers state': 'Rivers',
  'ogun state': 'Ogun',
  'oyo state': 'Oyo',
  'kano state': 'Kano',
  'kaduna state': 'Kaduna',
  'enugu state': 'Enugu',
  'delta state': 'Delta',
  'edo state': 'Edo',
  'anambra state': 'Anambra',
};

const TEXT_CONTENT_TYPE_MAP: Partial<
  Record<keyof ShippingAddressInput, TextContentType>
> = {
  email: TextContentTypes.emailAddress,
  firstName: TextContentTypes.givenName,
  lastName: TextContentTypes.familyName,
  phone: TextContentTypes.telephoneNumber,
  address: TextContentTypes.fullStreetAddress,
  city: TextContentTypes.addressCity,
};

const AUTO_COMPLETE_MAP: Partial<
  Record<keyof ShippingAddressInput, TextInputAutoComplete>
> = {
  email: 'email',
  firstName: 'name-given',
  lastName: 'name-family',
  phone: 'tel',
  address: 'street-address',
  city: 'postal-address-locality',
};

function normalizeStateName(
  googleState: string,
  knownStates: string[]
): string {
  const trimmed = googleState.trim();
  if (knownStates.includes(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  const exactMatch = knownStates.find((s) => s.toLowerCase() === lower);
  if (exactMatch) return exactMatch;
  const alias = GOOGLE_STATE_ALIASES[lower];
  if (alias && knownStates.includes(alias)) return alias;
  const withoutSuffix = lower.replace(/\s+state$/i, '');
  const suffixMatch = knownStates.find(
    (s) => s.toLowerCase() === withoutSuffix
  );
  if (suffixMatch) return suffixMatch;
  return trimmed;
}

function FormField({
  name,
  label,
  placeholder,
  control,
  errors,
  colors,
  keyboardType = 'default',
  multiline = false,
  containerStyle,
  returnKeyType = 'next',
  onSubmitEditing,
  transformText,
  maxLength,
  autoCapitalize,
}: {
  name: keyof ShippingAddressInput;
  label: string;
  placeholder: string;
  control: Control<ShippingAddressInput>;
  errors: FieldErrors<ShippingAddressInput>;
  colors: ThemeColors;
  keyboardType?: 'default' | 'phone-pad' | 'email-address';
  multiline?: boolean;
  containerStyle?: ViewStyle;
  returnKeyType?: 'next' | 'done' | 'go';
  onSubmitEditing?: () => void;
  transformText?: (value: string, previous: string) => string;
  maxLength?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  return (
    <View style={[styles.inputGroup, containerStyle]}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, onBlur, value } }) => {
          const stringValue = typeof value === 'string' ? value : '';

          return (
            <TextInput
              style={[
                styles.input,
                multiline && styles.multilineInput,
                { backgroundColor: colors.card, color: colors.text },
                { borderColor: errors[name] ? colors.error : colors.border },
              ]}
              value={stringValue}
              onChangeText={(text) => {
                const currentValue = stringValue;
                const processed = transformText
                  ? transformText(text, currentValue)
                  : text;
                if (processed !== currentValue) {
                  onChange(processed);
                }
              }}
              onBlur={onBlur}
              maxLength={maxLength}
              placeholder={placeholder}
              placeholderTextColor={colors.textSecondary}
              keyboardType={keyboardType}
              multiline={multiline}
              numberOfLines={multiline ? 2 : 1}
              accessibilityLabel={label}
              accessibilityHint={`Enter your ${label}`}
              textContentType={TEXT_CONTENT_TYPE_MAP[name]}
              autoComplete={AUTO_COMPLETE_MAP[name]}
              autoCapitalize={autoCapitalize}
              returnKeyType={multiline ? 'default' : returnKeyType}
              blurOnSubmit={!multiline}
              onSubmitEditing={onSubmitEditing}
            />
          );
        }}
      />
      {errors[name] && (
        <Text style={styles.fieldError} accessibilityLiveRegion="polite">
          {errors[name]?.message}
        </Text>
      )}
    </View>
  );
}

type FetchQuotesArgs = {
  apiUrl: string;
  state: string;
  city: string;
  items: CartItem[];
  customer: Customer | null;
  watchedFirstName: string;
  watchedLastName: string;
  watchedPhone: string;
  watchedAddress: string;
  watchedEmail: string;
  setIsLoadingQuotes: (value: boolean) => void;
  setSelectedQuoteId: (value: string) => void;
  setShippingQuotes: (value: ShippingQuote[]) => void;
  signal?: AbortSignal;
};

const fetchShippingQuotes = async ({
  apiUrl,
  state,
  city,
  items,
  customer,
  watchedFirstName,
  watchedLastName,
  watchedPhone,
  watchedAddress,
  watchedEmail,
  setIsLoadingQuotes,
  setSelectedQuoteId,
  setShippingQuotes,
  signal,
}: FetchQuotesArgs) => {
  if (!state || !city || items.length === 0) return;

  setIsLoadingQuotes(true);
  setSelectedQuoteId('');

  try {
    const res = await fetch(`${apiUrl}/api/shipping/quotes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receiver: {
          name:
            `${watchedFirstName} ${watchedLastName}`.trim() ||
            'Valued Customer',
          email: customer?.email || watchedEmail || 'guest@example.com',
          phone: watchedPhone || '',
          address: watchedAddress || `${city}, ${state}`,
          city,
          state,
          country: 'Nigeria',
        },
        items: items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          weight: 1,
          value: item.negotiatedPrice ?? item.price,
        })),
      }),
      signal,
    });

    // If aborted between fetch and processing, bail out silently
    if (signal?.aborted) return;

    if (res.ok) {
      const data: QuoteResponse & { warnings?: string[] } = await res.json();
      const quotes = data.quotes?.all || [];
      setShippingQuotes(quotes);

      if (quotes.length > 0) {
        const cheapest = quotes.reduce((prev, current) =>
          prev.price <= current.price ? prev : current
        );
        setSelectedQuoteId(String(cheapest.id));
      }
    } else {
      setShippingQuotes([]);
    }
  } catch (_error) {
    // Don't update state if the request was aborted (superseded by a newer request)
    if (signal?.aborted) return;
    setShippingQuotes([]);
  } finally {
    // Don't clear loading state if aborted — the newer request owns loading state
    if (!signal?.aborted) {
      setIsLoadingQuotes(false);
    }
  }
};

export default function CheckoutScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const items = useCartStore((state) => state.items);
  const subtotal = useCartStore((state) => state.subtotal());
  const clearCart = useCartStore((state) => state.clearCart);
  const customer = useAuthStore((state) => state.customer);
  const { isInitialized } = useAuthStatus();

  const { data: paymentSettings } = useMerchantPaymentSettings();
  const enabledPaymentMethods = getEnabledPaymentMethods(paymentSettings);

  const [step, setStep] = React.useState<CheckoutStep>('address');
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [orderTotals, setOrderTotals] = React.useState<{
    total: number;
    taxAmount: number;
  } | null>(null);
  const [selectedPayment, setSelectedPayment] =
    React.useState<PaymentMethodType>('paystack');
  const [paymentTab, setPaymentTab] = React.useState<PaymentTab>('full');

  const [shippingStates, setShippingStates] = React.useState<string[]>([]);
  const [shippingCities, setShippingCities] = React.useState<string[]>([]);
  const [shippingQuotes, setShippingQuotes] = React.useState<ShippingQuote[]>(
    []
  );
  const [selectedQuoteId, setSelectedQuoteId] = React.useState<string>('');
  const [isLoadingLocations, setIsLoadingLocations] = React.useState(false);
  const [isLoadingCities, setIsLoadingCities] = React.useState(false);
  const [isLoadingQuotes, setIsLoadingQuotes] = React.useState(false);
  const [showStatePicker, setShowStatePicker] = React.useState(false);
  const [showCityPicker, setShowCityPicker] = React.useState(false);
  const [citySearch, setCitySearch] = React.useState('');
  const [saveDetails, setSaveDetails] = React.useState(false);
  const [accountPassword, setAccountPassword] = React.useState('');

  // Crypto payment inline modal state
  const [showCryptoSelection, setShowCryptoSelection] = React.useState(false);
  const [cryptoPayment, setCryptoPayment] = React.useState<{
    orderId: string;
    orderNumber: string;
    address: string;
    chain: string;
    currency: string;
    amount: number;
    cryptoAmount: string;
    confirmationTime: string;
    reference: string;
    paymentId: string;
    trackingToken?: string;
  } | null>(null);

  // Partial order state for multi-step crypto flow
  const [pendingOrder, setPendingOrder] =
    React.useState<PendingCryptoOrder | null>(null);

  const [copiedCryptoField, setCopiedCryptoField] = React.useState<
    string | null
  >(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
    getValues,
    setValue,
    reset,
  } = useForm<ShippingAddressInput>({
    resolver: shippingAddressResolver,
    defaultValues: {
      email: customer?.email || '',
      firstName: customer?.first_name || '',
      lastName: customer?.last_name || '',
      phone: customer?.phone || '',
      address: '',
      city: '',
      state: '',
      notes: '',
    },
    mode: 'onBlur',
  });

  const watchedState = watch('state');
  const watchedCity = watch('city');
  const watchedAddress = watch('address');
  const watchedPhone = watch('phone');
  const watchedFirstName = watch('firstName');
  const watchedLastName = watch('lastName');
  const watchedEmail = watch('email');

  const hasTrackedStart = useRef(false);
  const isOrderInFlight = useRef(false);
  // Sentinel: stores the city Google Places suggested, so we can match it
  // against the Topship cities list once they load.
  // null = no pending suggestion, '' = state=city edge case (open picker)
  const googleSuggestedCityRef = useRef<string | null>(null);
  // AbortController for shipping quote requests — prevents race conditions
  // when multiple requests fire (e.g. rapid city/state changes)
  const shippingQuoteAbortRef = useRef<AbortController | null>(null);
  // Timer ref for crypto copy feedback — prevents setState after unmount
  const cryptoCopyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup crypto copy timer on unmount
  useEffect(() => {
    return () => {
      if (cryptoCopyTimerRef.current) clearTimeout(cryptoCopyTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!hasTrackedStart.current && items.length > 0) {
      trackCheckoutStarted({
        itemCount: items.reduce((acc, item) => acc + item.quantity, 0),
        subtotal,
        currency: 'NGN',
      });
      hasTrackedStart.current = true;
    }
  }, [items, subtotal]);

  // Auth check for protected checkout actions
  useEffect(() => {
    if (!isInitialized) return;

    // Check if user is trying to place order but not authenticated
    // This prevents unauthorized checkout attempts
    if (step === 'review' && !customer) {
      Alert.alert(
        'Sign In Required',
        'Please sign in to complete your order.',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => router.back() },
          { text: 'Sign In', onPress: () => router.push('/auth/login') },
        ]
      );
    }
  }, [step, customer, isInitialized]);

  // Mid-checkout login: sync customer data into form, preserving fields the user already edited
  useEffect(() => {
    if (!customer) return;
    reset(
      {
        email: customer.email || '',
        firstName: customer.first_name || '',
        lastName: customer.last_name || '',
        phone: customer.phone || '',
        address: getValues('address'),
        city: getValues('city'),
        state: getValues('state'),
        notes: getValues('notes'),
      },
      { keepDirtyValues: true }
    );
  }, [customer, reset, getValues]);

  // Reset payment method if current selection is not in enabled list
  useEffect(() => {
    if (
      enabledPaymentMethods.length > 0 &&
      !enabledPaymentMethods.includes(selectedPayment)
    ) {
      setSelectedPayment(enabledPaymentMethods[0]);
      // Reset to full tab if BNPL methods are disabled
      if (paymentTab === 'installments') {
        const hasBNPL = enabledPaymentMethods.some(
          (m) => m === 'credpal' || m === 'credit_direct'
        );
        if (!hasBNPL) setPaymentTab('full');
      }
    }
  }, [enabledPaymentMethods, selectedPayment, paymentTab]);

  const performBackTransition = () => {
    if (step === 'payment') {
      setStep('address');
    } else if (step === 'review') {
      setStep('payment');
    } else {
      router.back();
    }
  };

  const handleBack = () => {
    performBackTransition();
  };

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (isOrderInFlight.current) {
          return true;
        }
        if (step === 'address') {
          Alert.alert(
            'Leave Checkout?',
            'Your cart items will be saved. Are you sure you want to leave?',
            [
              { text: 'Stay', style: 'cancel' },
              {
                text: 'Leave',
                style: 'destructive',
                onPress: () => performBackTransition(),
              },
            ]
          );
          return true;
        }
        performBackTransition();
        return true;
      }
    );

    return () => backHandler.remove();
  }, [step, performBackTransition]);

  useEffect(() => {
    const fetchLocations = async () => {
      setIsLoadingLocations(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/shipping/locations`);
        if (res.ok) {
          const data = await res.json();
          setShippingStates(data.states || []);
        }
      } catch (_error) {
        // Silent fail
      } finally {
        setIsLoadingLocations(false);
      }
    };
    fetchLocations();
  }, []);

  useEffect(() => {
    if (!watchedState) {
      setShippingCities([]);
      setIsLoadingCities(false);
      return;
    }
    const controller = new AbortController();
    setShippingCities([]);
    setIsLoadingCities(true);
    const fetchCities = async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/shipping/locations?state=${encodeURIComponent(
            watchedState
          )}`,
          { signal: controller.signal }
        );
        if (controller.signal.aborted) return;
        if (res.ok) {
          const data = await res.json();
          const normalizedState = watchedState.trim().toLowerCase();
          const cities = [
            ...new Set(
              (data.locations as ShippingLocation[])
                .filter((location) => {
                  const locationState = location.state?.trim().toLowerCase();
                  return locationState
                    ? locationState === normalizedState
                    : true;
                })
                .map((location) => location.city)
            ),
          ].sort();
          setShippingCities(cities);
        } else {
          setShippingCities([]);
        }
      } catch (_error) {
        if (!controller.signal.aborted) {
          setShippingCities([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingCities(false);
        }
      }
    };
    fetchCities();
    return () => controller.abort();
  }, [watchedState]);

  // Sentinel: when Topship cities finish loading, match the Google-suggested city
  useEffect(() => {
    if (isLoadingCities || shippingCities.length === 0) return;

    const suggestedCity = googleSuggestedCityRef.current;
    if (suggestedCity === null) return; // No pending Google suggestion

    // Clear so this only runs once per selection
    googleSuggestedCityRef.current = null;

    if (suggestedCity === '') {
      // State = City edge case: open picker for user to search
      setShowCityPicker(true);
      return;
    }

    // Search for a case-insensitive match in the Topship cities list
    const match = shippingCities.find(
      (c) => c.toLowerCase() === suggestedCity.toLowerCase()
    );

    if (match) {
      // Perfect match - auto-select it
      setValue('city', match, { shouldValidate: true });
    } else {
      // No match - open picker with Google city pre-filled as search
      setCitySearch(suggestedCity);
      setShowCityPicker(true);
    }
  }, [shippingCities, isLoadingCities, setValue]);

  useEffect(() => {
    // Abort any in-flight shipping quote request before starting a new one
    if (shippingQuoteAbortRef.current) {
      shippingQuoteAbortRef.current.abort();
    }

    if (watchedState && watchedCity) {
      const controller = new AbortController();
      shippingQuoteAbortRef.current = controller;

      fetchShippingQuotes({
        apiUrl: API_BASE_URL,
        state: watchedState,
        city: watchedCity,
        items,
        customer,
        watchedFirstName,
        watchedLastName,
        watchedPhone,
        watchedAddress,
        watchedEmail,
        setIsLoadingQuotes,
        setSelectedQuoteId,
        setShippingQuotes,
        signal: controller.signal,
      });
    } else {
      shippingQuoteAbortRef.current = null;
      setShippingQuotes([]);
      setSelectedQuoteId('');
    }

    return () => {
      // Cleanup: abort on unmount or before next effect run
      if (shippingQuoteAbortRef.current) {
        shippingQuoteAbortRef.current.abort();
      }
    };
    // Only refetch when location or items change — receiver details don't affect quote pricing
  }, [
    watchedState,
    watchedCity,
    items,
    customer,
    watchedAddress,
    watchedEmail,
    watchedFirstName,
    watchedLastName,
    watchedPhone,
  ]);

  const selectedQuote = shippingQuotes.find(
    (quote) => String(quote.id) === String(selectedQuoteId)
  );
  const deliveryFee = selectedQuote?.price ?? 0;

  // Calculate total assurance fee from cart items (2026 Best Practice: Single Source of Truth)
  const assuranceFee = items.reduce((sum, item) => {
    if (item.hasAssurance) {
      return (
        sum +
        Math.round(
          (item.negotiatedPrice ?? item.price) *
            item.quantity *
            (item.assuranceRate ?? 0.05)
        )
      );
    }
    return sum;
  }, 0);

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
        // Silent fail
      }
    };
    fetchTotals();
  }, [subtotal, deliveryFee, paymentSettings, assuranceFee]);

  const taxAmount = orderTotals?.taxAmount ?? 0;
  const total =
    orderTotals?.total ?? subtotal + deliveryFee + assuranceFee + taxAmount;
  // Show subtotal + delivery + assurance (no VAT) in steps 1 & 2; full total (with VAT) in Review
  const displayTotal =
    step === 'review' ? total : subtotal + deliveryFee + assuranceFee;

  const onAddressSubmit = (data: ShippingAddressInput) => {
    trackCheckoutStep('shipping_info', {
      state: data.state,
      city: data.city,
    });
    setStep('payment');
  };

  const handleContinue = () => {
    Keyboard.dismiss();

    if (step === 'address') {
      handleSubmit(onAddressSubmit)();
    } else if (step === 'payment') {
      trackCheckoutStep('payment_method', {
        payment_method: selectedPayment,
      });
      setStep('review');
    }
  };

  const handleSelectState = (state: string) => {
    setValue('state', state, { shouldValidate: true });
    setValue('city', '', { shouldValidate: true });
    setShowStatePicker(false);
  };

  const handleSelectCity = (city: string) => {
    setValue('city', city, { shouldValidate: true });
    setShowCityPicker(false);
    setCitySearch('');
  };

  const handleCryptoConfirm = async (chain: string, currency: string) => {
    if (!pendingOrder) return;

    // Re-validate that the crypto payment amount still matches the current
    // order total before initiating payment (Bug #25 fix)
    const { orderResponse: pendingResponse } = pendingOrder;
    if (pendingResponse.amountDueToGateway !== total) {
      Alert.alert(
        'Amount Changed',
        'Your order total has changed since the order was created. Please go back and try again.',
        [{ text: 'OK' }]
      );
      setPendingOrder(null);
      setShowCryptoSelection(false);
      return;
    }

    setIsProcessing(true);
    // Keep CryptoSelectionModal open (with spinner) while API loads

    try {
      const {
        order,
        orderResponse,
        customerEmail,
        customerName,
        customerPhone,
        trackingToken,
      } = pendingOrder;

      const initResponse = await fetch(
        `${API_BASE_URL}/api/payments/initialize`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': `crypto-init-${order.id}-${chain}-${currency}`,
          },
          body: JSON.stringify({
            merchant_id: MERCHANT_ID,
            order_id: order.id,
            amount: orderResponse.amountDueToGateway,
            currency: 'NGN',
            customer_email: customerEmail,
            customer_name: customerName,
            customer_phone: customerPhone,
            gateway: 'juicyway',
            crypto_chain: chain,
            crypto_currency: currency,
          }),
        }
      );

      const initData = await initResponse.json();

      if (!initResponse.ok || !initData.success) {
        throw new OrderError(
          initData.error || 'Failed to initialize crypto payment',
          'PAYMENT_INIT_ERROR'
        );
      }

      if (!initData.crypto_payment?.address) {
        throw new OrderError(
          'Failed to generate crypto wallet address. Please try again.',
          'PAYMENT_INIT_ERROR'
        );
      }

      setIsProcessing(false);
      setShowCryptoSelection(false);
      isOrderInFlight.current = false;

      const cp = initData.crypto_payment;
      setCryptoPayment({
        orderId: order.id,
        orderNumber: order.order_number || order.id.slice(0, 8).toUpperCase(),
        address: cp.address,
        chain: cp.chain || chain,
        currency: cp.currency || currency,
        amount: cp.amount || orderResponse.amountDueToGateway,
        cryptoAmount: cp.crypto_amount || '',
        confirmationTime: cp.confirmation_time || '',
        reference: initData.reference || '',
        paymentId: cp.payment_id || '',
        trackingToken,
      });
    } catch (error) {
      setIsProcessing(false);
      setShowCryptoSelection(false);
      isOrderInFlight.current = false;
      if (error instanceof OrderError) {
        Alert.alert('Payment Error', error.message);
      } else {
        Alert.alert('Error', 'Failed to initialize payment');
      }
    } finally {
      setPendingOrder(null);
    }
  };

  // 2026 Fix: Renamed to onCheckoutSubmit to work with handleSubmit
  const onCheckoutSubmit = async (address: ShippingAddressInput) => {
    // Capture a snapshot of items at the start of the async flow so that
    // any concurrent cart mutations do not affect the in-flight order.
    const itemsSnapshot = [...useCartStore.getState().items];

    // BUG-1-003 Fix: Validate cart FIRST before any processing
    if (itemsSnapshot.length === 0) {
      Alert.alert(
        'Empty Cart',
        'Your cart is empty. Please add items before checking out.',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]
      );
      return;
    }

    if (isOrderInFlight.current || isProcessing) {
      return;
    }

    // Re-validate that the selected payment method is still enabled
    // (merchant may have toggled it since the user selected it)
    if (
      enabledPaymentMethods.length > 0 &&
      !enabledPaymentMethods.includes(selectedPayment)
    ) {
      Alert.alert(
        'Payment Method Unavailable',
        'The selected payment method is no longer available. Please choose another.',
        [{ text: 'OK', onPress: () => setStep('payment') }]
      );
      return;
    }

    // Validate that a shipping quote is selected when shipping quotes are
    // available (i.e. the address step fetched quotes for the chosen location)
    if (shippingQuotes.length > 0 && !selectedQuoteId) {
      Alert.alert(
        'Shipping Required',
        'Please select a delivery option before placing your order.',
        [{ text: 'OK', onPress: () => setStep('address') }]
      );
      return;
    }

    isOrderInFlight.current = true;
    setIsProcessing(true);

    // BUG-1-002 Fix: Snapshot cart items for rollback if needed
    const cartSnapshot = [...itemsSnapshot];

    // Snapshot all order values at submission time to avoid stale closures.
    // Compute subtotal from the snapshotted items (not the closure value).
    const snapshotSubtotal = itemsSnapshot.reduce((total, item) => {
      const effectivePrice = item.negotiatedPrice ?? item.price;
      return total + effectivePrice * item.quantity;
    }, 0);
    const snapshotDeliveryFee = deliveryFee;
    const snapshotTaxAmount = orderTotals?.taxAmount ?? 0;

    try {
      trackCheckoutStep('review');

      // 2026 Fix: Use validated address from handleSubmit instead of getValues()
      // const address = getValues(); // Removed to prevent bypass
      const customerEmail = customer?.email || address.email;
      const customerPhone = address.phone;
      const customerName = `${address.firstName} ${address.lastName}`;

      const isBNPL =
        selectedPayment === 'credpal' || selectedPayment === 'credit_direct';

      if (isBNPL) {
        const orderResponse = await createOrder({
          customer_email: customerEmail,
          customer_name: customerName,
          customer_phone: customerPhone,
          items: itemsSnapshot.map((item) => {
            const effectivePrice = item.negotiatedPrice ?? item.price;
            return {
              id: item.product_id,
              product_id: item.product_id,
              name: item.name,
              quantity: item.quantity,
              price: effectivePrice,
              image_url: item.image_url,
              variant_id: item.variant_id,
              variant_attributes: item.variant_attributes,
              has_assurance: item.hasAssurance || false,
              assurance_fee: item.hasAssurance
                ? Math.round(
                    effectivePrice *
                      item.quantity *
                      (item.assuranceRate ?? 0.05)
                  )
                : 0,
            };
          }),
          subtotal: snapshotSubtotal,
          shipping_fee: snapshotDeliveryFee,
          tax_amount: snapshotTaxAmount,
          payment_method: selectedPayment,
          shipping_address: address,
          source: 'mobile_app',
        });

        isOrderInFlight.current = false;
        setIsProcessing(false);

        router.push({
          pathname: '/bnpl-checkout',
          params: {
            orderId: orderResponse.order.id,
            gateway: selectedPayment,
            amount: String(orderResponse.amountDueToGateway),
            customerEmail,
            customerName,
            customerPhone,
            merchantSlug: MERCHANT_SLUG,
          },
        });
        return;
      }

      const orderResponse = await createOrder({
        customer_email: customerEmail,
        customer_name: customerName,
        customer_phone: customerPhone,
        items: itemsSnapshot.map((item) => {
          const effectivePrice = item.negotiatedPrice ?? item.price;
          return {
            id: item.product_id,
            product_id: item.product_id,
            name: item.name,
            quantity: item.quantity,
            price: effectivePrice,
            image_url: item.image_url,
            variant_id: item.variant_id,
            variant_attributes: item.variant_attributes,
            has_assurance: item.hasAssurance || false,
            assurance_fee: item.hasAssurance
              ? Math.round(
                  effectivePrice * item.quantity * (item.assuranceRate ?? 0.05)
                )
              : 0,
          };
        }),
        subtotal: snapshotSubtotal,
        shipping_fee: snapshotDeliveryFee,
        tax_amount: snapshotTaxAmount,
        payment_method: selectedPayment,
        shipping_address: address,
        source: 'mobile_app',
      });

      const { order } = orderResponse;
      const orderNumber =
        order.order_number || order.id.slice(0, 8).toUpperCase();

      trackOrderCompleted({
        orderId: order.id,
        orderNumber,
        total: order.total,
        subtotal: snapshotSubtotal,
        shipping: snapshotDeliveryFee,
        tax: snapshotTaxAmount,
        currency: 'NGN',
        itemCount: itemsSnapshot.reduce((acc, item) => acc + item.quantity, 0),
        paymentMethod: selectedPayment,
      });

      await scheduleLocalNotification(
        'Order Received! 📦',
        `Your order #${orderNumber} is being processed. We'll notify you when it ships.`,
        { type: 'order_update', orderNumber, orderId: order.id },
        1
      );

      // Silent account creation for guests who opted in
      if (saveDetails && accountPassword.length >= 6) {
        try {
          await supabase.auth.signUp({
            email: customerEmail,
            password: accountPassword,
            options: {
              data: {
                first_name: address.firstName,
                last_name: address.lastName,
                phone: address.phone,
              },
            },
          });
        } catch {
          // Non-blocking: order already placed, account creation is best-effort
        }
      }

      // Route based on payment method
      const isOnlinePayment =
        selectedPayment === 'paystack' || selectedPayment === 'korapay';
      const isBankTransfer = selectedPayment === 'bank_transfer';
      const isJuicyway = selectedPayment === 'juicyway';

      // Juicyway crypto: Show selection modal first
      if (isJuicyway) {
        setPendingOrder({
          order,
          orderResponse,
          customerEmail,
          customerName,
          customerPhone,
          trackingToken: order.tracking_token || undefined,
        });
        setIsProcessing(false);
        isOrderInFlight.current = false;
        setShowCryptoSelection(true);
        return;
      }

      if (isOnlinePayment || isBankTransfer) {
        // Initialize payment gateway
        const gateway = isBankTransfer ? 'paystack' : selectedPayment;
        const initResponse = await fetch(
          `${API_BASE_URL}/api/payments/initialize`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Idempotency-Key': `payment-init-${order.id}-${gateway}`,
            },
            body: JSON.stringify({
              merchant_id: MERCHANT_ID,
              order_id: order.id,
              amount: orderResponse.amountDueToGateway,
              currency: 'NGN',
              customer_email: customerEmail,
              customer_name: customerName,
              customer_phone: customerPhone,
              gateway,
              ...(isBankTransfer && { payment_type: 'dva' }),
            }),
          }
        );

        const initData = await initResponse.json();

        if (!initResponse.ok || !initData.success) {
          throw new OrderError(
            initData.error || 'Failed to initialize payment',
            'PAYMENT_INIT_ERROR'
          );
        }

        setIsProcessing(false);

        if (isBankTransfer) {
          router.push({
            pathname: '/bank-transfer',
            params: {
              orderId: order.id,
              orderNumber,
              reference: initData.reference,
              amount: String(orderResponse.amountDueToGateway),
              bankName:
                initData.dva?.bank_name ||
                initData.virtual_account?.bank_name ||
                '',
              accountNumber:
                initData.dva?.account_number ||
                initData.virtual_account?.account_number ||
                '',
              accountName:
                initData.dva?.account_name ||
                initData.virtual_account?.account_name ||
                '',
            },
          });
        } else {
          const authUrl = initData.authorization_url || initData.checkout_url;
          router.push({
            pathname: '/payment-gateway',
            params: {
              orderId: order.id,
              orderNumber,
              gateway: selectedPayment,
              authorizationUrl: authUrl,
              reference: initData.reference,
              amount: String(orderResponse.amountDueToGateway),
            },
          });
        }
        return;
      }

      // BUG-1-002 Fix: Pay on delivery — clear cart BEFORE navigation
      // This prevents duplicate orders from race conditions
      clearCart();

      // Flush cleared cart to AsyncStorage explicitly.
      // syncStorage.setItem (used by Zustand persist) updates the in-memory cache
      // synchronously but fires AsyncStorage.setItem as fire-and-forget. We must
      // await the real write to guarantee persistence before navigation.
      const persistOpts = useCartStore.persist.getOptions();
      const partialize = persistOpts.partialize ?? ((s: unknown) => s);
      const persistedState = partialize(useCartStore.getState());
      await AsyncStorage.setItem(
        persistOpts.name ?? 'cart-storage',
        JSON.stringify({
          state: persistedState,
          version: persistOpts.version ?? 0,
        })
      );

      // Navigate to success after cart is cleared
      router.replace({
        pathname: '/order-success',
        params: {
          orderId: order.id,
          orderNumber,
          ...(order.tracking_token && {
            trackingToken: order.tracking_token,
          }),
        },
      });
    } catch (error) {
      // BUG-1-002 Fix: Rollback cart on error
      // Restore cart items if order creation failed
      // Use restoreItems to replace the entire array without generating new IDs
      if (cartSnapshot && useCartStore.getState().items.length === 0) {
        useCartStore.getState().restoreItems(cartSnapshot);
      }
      if (error instanceof OrderError) {
        trackError('checkout_failed', error.message, {
          step: 'place_order',
          paymentMethod: selectedPayment,
          errorCode: error.code,
        });

        switch (error.code) {
          case 'NETWORK_ERROR':
            Alert.alert(
              'No Connection',
              'Please check your internet connection and try again.',
              [{ text: 'OK' }]
            );
            break;
          case 'VALIDATION_ERROR':
            Alert.alert(
              'Invalid Information',
              error.message || 'Please check your order details and try again.',
              [{ text: 'OK' }]
            );
            break;
          case 'AUTH_ERROR':
            Alert.alert(
              'Session Expired',
              'Please sign in again to complete your order.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign In', onPress: () => router.push('/auth/login') },
              ]
            );
            break;
          default:
            Alert.alert(
              'Order Failed',
              error.message || 'Something went wrong. Please try again.',
              [{ text: 'OK' }]
            );
        }
      } else {
        trackError(
          'checkout_failed',
          error instanceof Error ? error.message : 'Unknown error',
          { step: 'place_order', paymentMethod: selectedPayment }
        );
        Alert.alert('Error', 'Failed to place order. Please try again.', [
          { text: 'OK' },
        ]);
      }
    } finally {
      setIsProcessing(false);
      isOrderInFlight.current = false;
    }
  };

  // 2026 Fix: Wrap submission in handleSubmit to enforce validation
  const handlePlaceOrder = handleSubmit(onCheckoutSubmit, (errors) => {
    console.log('Validation errors:', errors);
    Alert.alert(
      'Incomplete Details',
      'Please fill in all required fields (Address, City, Phone) to place your order.',
      [{ text: 'OK' }]
    );
  });

  const renderStepIndicator = () => {
    const steps: CheckoutStep[] = ['address', 'payment', 'review'];
    const currentIndex = steps.indexOf(step);

    return (
      <View style={styles.stepIndicator}>
        <View style={styles.stepHeaderRow}>
          <Text style={[styles.stepTitle, { color: colors.text }]}>
            Checkout
          </Text>
          <View style={styles.stepBadge}>
            <Ionicons name="checkmark" size={12} color={BRAND.primary} />
            <Text style={styles.stepBadgeText}>
              {items.length} item{items.length === 1 ? '' : 's'}
            </Text>
          </View>
        </View>
        <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
          Step {currentIndex + 1} of 3
        </Text>
        <View style={styles.stepProgress}>
          <View
            style={[
              styles.stepProgressActive,
              { width: `${((currentIndex + 1) / 3) * 100}%` },
            ]}
          />
        </View>
        <View style={styles.stepPills}>
          {steps.map((s, index) => {
            const isActive = s === step;
            const isCompleted = index < currentIndex;
            return (
              <View
                key={s}
                style={[
                  styles.stepPill,
                  {
                    backgroundColor: isActive ? palette.red[50] : colors.card,
                    borderColor:
                      isActive || isCompleted ? BRAND.primary : colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.stepPillDot,
                    {
                      backgroundColor:
                        isActive || isCompleted ? BRAND.primary : colors.border,
                    },
                  ]}
                >
                  {isCompleted ? (
                    <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                  ) : (
                    <Text
                      style={[
                        styles.stepPillNumber,
                        { color: isActive ? '#FFFFFF' : colors.textSecondary },
                      ]}
                    >
                      {index + 1}
                    </Text>
                  )}
                </View>
                <Text
                  style={[
                    styles.stepPillText,
                    { color: isActive ? colors.text : colors.textSecondary },
                  ]}
                >
                  {STEP_PILL_LABELS[s]}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderAddressForm = () => (
    <ScrollView
      style={styles.formContainer}
      contentContainerStyle={styles.formContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Delivery Address
        </Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          Use your default details or edit for this delivery.
        </Text>
      </View>

      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            overflow: 'visible',
            zIndex: 20,
            position: 'relative',
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <Ionicons name="person-outline" size={16} color={BRAND.primary} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Contact
          </Text>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.row}>
            <View style={styles.halfInput}>
              <FormField
                name="firstName"
                label="First Name"
                placeholder="John"
                control={control}
                errors={errors}
                colors={colors}
                maxLength={50}
                transformText={(text) => text.replace(/\d/g, '')}
              />
            </View>
            <View style={styles.halfInput}>
              <FormField
                name="lastName"
                label="Last Name"
                placeholder="Doe"
                control={control}
                errors={errors}
                colors={colors}
                maxLength={50}
                transformText={(text) => text.replace(/\d/g, '')}
              />
            </View>
          </View>

          <Controller
            control={control}
            name="phone"
            render={({ field: { value, onChange } }) => (
              <PhoneInput
                value={value}
                onChangeText={onChange}
                label="Phone Number"
                placeholder="8012345678"
                error={errors.phone?.message}
                containerStyle={styles.inputGroup}
              />
            )}
          />

          <FormField
            name="email"
            label="Email Address"
            placeholder="you@example.com"
            control={control}
            errors={errors}
            colors={colors}
            keyboardType="email-address"
            maxLength={255}
            autoCapitalize="none"
            transformText={(text) => text.toLowerCase()}
          />

          {/* Save Details Checkbox — guests only */}
          {!customer && (
            <View style={styles.saveDetailsSection}>
              <Pressable
                style={styles.checkboxRow}
                onPress={() => setSaveDetails(!saveDetails)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: saveDetails }}
                accessibilityLabel="Save my details for faster checkout"
              >
                <View
                  style={[
                    styles.checkbox,
                    saveDetails && styles.checkboxChecked,
                    {
                      borderColor: saveDetails ? BRAND.primary : colors.border,
                    },
                  ]}
                >
                  {saveDetails && (
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  )}
                </View>
                <Text style={[styles.checkboxLabel, { color: colors.text }]}>
                  Save my details for faster checkout
                </Text>
              </Pressable>

              {saveDetails && (
                <>
                  <View
                    style={[
                      styles.accountInfoBanner,
                      { backgroundColor: `${BRAND.primary}10` },
                    ]}
                  >
                    <Ionicons
                      name="information-circle"
                      size={18}
                      color={BRAND.primary}
                    />
                    <Text
                      style={[
                        styles.accountInfoText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      This will create an account so you can track your order
                      and checkout faster next time.
                    </Text>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text
                      style={[styles.label, { color: colors.textSecondary }]}
                    >
                      Create a Password
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: colors.card,
                          color: colors.text,
                          borderColor:
                            accountPassword.length > 0 &&
                            accountPassword.length < 6
                              ? '#EF4444'
                              : colors.border,
                        },
                      ]}
                      value={accountPassword}
                      onChangeText={setAccountPassword}
                      placeholder="Min. 6 characters"
                      placeholderTextColor={colors.textSecondary}
                      secureTextEntry
                      autoComplete="new-password"
                      textContentType="newPassword"
                      accessibilityLabel="Create a password"
                    />
                    {accountPassword.length > 0 &&
                      accountPassword.length < 6 && (
                        <Text style={styles.fieldError}>
                          Password must be at least 6 characters
                        </Text>
                      )}
                  </View>
                </>
              )}
            </View>
          )}
        </View>
      </View>

      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            zIndex: 10,
            position: 'relative',
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <Ionicons name="location-outline" size={16} color={BRAND.primary} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Delivery
          </Text>
        </View>
        <View style={[styles.cardBody, { overflow: 'visible', zIndex: 50 }]}>
          <Controller
            control={control}
            name="address"
            render={({ field: { value, onChange } }) => (
              <AddressAutocomplete
                value={value}
                onChangeText={onChange}
                onSelect={(place) => {
                  onChange(place.formattedAddress || '');
                  const normalizedState = place.state
                    ? normalizeStateName(place.state, shippingStates)
                    : '';
                  // Store Google city for sentinel matching against Topship list
                  if (place.city) {
                    const normalizedCity = place.city.trim().toLowerCase();
                    if (
                      normalizedState &&
                      normalizedCity === normalizedState.toLowerCase()
                    ) {
                      // State = City edge case: sentinel will open picker
                      googleSuggestedCityRef.current = '';
                    } else {
                      googleSuggestedCityRef.current = place.city;
                    }
                  }
                  // Clear city - sentinel will set it after Topship cities load
                  setValue('city', '', { shouldValidate: false });
                  if (normalizedState) {
                    setValue('state', normalizedState, {
                      shouldValidate: true,
                    });
                  }
                }}
                label="Street Address"
                placeholder="Start typing your address..."
              />
            )}
          />

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                City
              </Text>
              <Controller
                control={control}
                name="city"
                render={({ field: { value } }) => (
                  <>
                    <Pressable
                      onPress={() => setShowCityPicker(true)}
                      style={[
                        styles.input,
                        styles.selectInput,
                        {
                          backgroundColor: colors.card,
                          borderColor: errors.city ? '#EF4444' : colors.border,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Select city"
                    >
                      <Text
                        style={{
                          color: value ? colors.text : colors.textSecondary,
                        }}
                      >
                        {value || 'Select city'}
                      </Text>
                      {isLoadingCities ? (
                        <ActivityIndicator
                          size="small"
                          color={colors.textSecondary}
                        />
                      ) : (
                        <Ionicons
                          name="chevron-down"
                          size={18}
                          color={colors.textSecondary}
                        />
                      )}
                    </Pressable>
                    {errors.city && (
                      <Text
                        style={styles.fieldError}
                        accessibilityLiveRegion="polite"
                      >
                        {errors.city?.message}
                      </Text>
                    )}
                  </>
                )}
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                State
              </Text>
              <Controller
                control={control}
                name="state"
                render={({ field: { value } }) => (
                  <>
                    <Pressable
                      onPress={() => setShowStatePicker(true)}
                      style={[
                        styles.input,
                        styles.selectInput,
                        {
                          backgroundColor: colors.card,
                          borderColor: errors.state ? '#EF4444' : colors.border,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Select state"
                    >
                      <Text
                        style={{
                          color: value ? colors.text : colors.textSecondary,
                        }}
                      >
                        {value || 'Select state'}
                      </Text>
                      {isLoadingLocations ? (
                        <ActivityIndicator
                          size="small"
                          color={colors.textSecondary}
                        />
                      ) : (
                        <Ionicons
                          name="chevron-down"
                          size={18}
                          color={colors.textSecondary}
                        />
                      )}
                    </Pressable>
                    {errors.state && (
                      <Text
                        style={styles.fieldError}
                        accessibilityLiveRegion="polite"
                      >
                        {errors.state?.message}
                      </Text>
                    )}
                  </>
                )}
              />
            </View>
          </View>
        </View>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.cardHeader}>
          <Ionicons name="cube-outline" size={16} color={BRAND.primary} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Shipping
          </Text>
        </View>
        <View style={styles.cardBody}>
          {!watchedState || !watchedCity ? (
            <Text style={[styles.helperText, { color: colors.textSecondary }]}>
              Select your state and city to see delivery options.
            </Text>
          ) : isLoadingQuotes ? (
            <View style={styles.quoteLoadingRow}>
              <ActivityIndicator size="small" color={BRAND.primary} />
              <Text
                style={[styles.helperText, { color: colors.textSecondary }]}
              >
                Fetching delivery options...
              </Text>
            </View>
          ) : shippingQuotes.length === 0 ? (
            <Pressable
              onPress={() => {
                if (watchedState && watchedCity) {
                  fetchShippingQuotes({
                    apiUrl: API_BASE_URL,
                    state: watchedState,
                    city: watchedCity,
                    items,
                    customer,
                    watchedFirstName,
                    watchedLastName,
                    watchedPhone,
                    watchedAddress,
                    watchedEmail,
                    setIsLoadingQuotes,
                    setSelectedQuoteId,
                    setShippingQuotes,
                  });
                }
              }}
              style={styles.retryCard}
              accessibilityRole="button"
              accessibilityLabel="Reload delivery rates"
            >
              <View style={styles.retryIconWrap}>
                <Ionicons name="car-outline" size={22} color="#B45309" />
              </View>
              <View style={styles.retryTextWrap}>
                <Text style={styles.retryTitle}>Oops! Rates took a detour</Text>
                <Text style={styles.retrySubtitle}>
                  Our delivery partners are a bit slow today. Tap here to try
                  again.
                </Text>
              </View>
              <View style={styles.retryBadge}>
                <Text style={styles.retryBadgeText}>Refresh Rates</Text>
              </View>
            </Pressable>
          ) : (
            shippingQuotes.map((quote) => {
              const isSelected = String(quote.id) === String(selectedQuoteId);
              const eta =
                quote.deliveryRange ||
                (quote.estimatedDays
                  ? `${quote.estimatedDays} days`
                  : 'ETA unavailable');

              const carrier = quote.carrierName || quote.provider || 'Delivery';

              return (
                <Pressable
                  key={String(quote.id)}
                  onPress={() => setSelectedQuoteId(String(quote.id))}
                  style={[
                    styles.quoteRow,
                    {
                      borderColor: isSelected ? BRAND.primary : colors.border,
                      backgroundColor: isSelected
                        ? palette.red[50]
                        : colors.card,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${quote.displayName} for ${formatPrice(quote.price)}`}
                >
                  <View style={styles.quoteInfo}>
                    <View style={styles.quoteHeader}>
                      <Text style={[styles.quoteTitle, { color: colors.text }]}>
                        {quote.displayName}
                      </Text>
                      {carrier.includes('GIG') && (
                        <View style={styles.quoteBadgeDark}>
                          <Text style={styles.quoteBadgeText}>GIGL</Text>
                        </View>
                      )}
                      {carrier.toLowerCase().includes('topship') && (
                        <View style={styles.quoteBadge}>
                          <Text style={styles.quoteBadgeText}>Topship</Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.quoteMeta,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {carrier} • Est. {eta}
                    </Text>
                  </View>
                  <View style={styles.quoteRight}>
                    <Text style={[styles.quotePrice, { color: colors.text }]}>
                      {formatPrice(quote.price)}
                    </Text>
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={20}
                      color={isSelected ? BRAND.primary : colors.textSecondary}
                    />
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.cardHeader}>
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={16}
            color={colors.textSecondary}
          />
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Delivery Notes
          </Text>
        </View>
        <View style={styles.cardBody}>
          <FormField
            name="notes"
            label="Notes (Optional)"
            placeholder="Any special instructions for delivery"
            multiline
            control={control}
            errors={errors}
            colors={colors}
          />
        </View>
      </View>
    </ScrollView>
  );

  const renderPaymentOptions = () => (
    <ScrollView
      style={styles.formContainer}
      contentContainerStyle={styles.formContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Payment Method
        </Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          Choose how you want to pay for this order.
        </Text>
      </View>

      <PaymentMethodSelector
        selectedMethod={selectedPayment}
        onSelectMethod={setSelectedPayment}
        selectedTab={paymentTab}
        onSelectTab={setPaymentTab}
        orderTotal={total}
        enabledMethods={enabledPaymentMethods}
      />
    </ScrollView>
  );

  const renderReview = () => {
    const address = getValues();

    return (
      <ScrollView
        style={styles.formContainer}
        contentContainerStyle={styles.formContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Review Order
          </Text>
          <Text
            style={[styles.sectionSubtitle, { color: colors.textSecondary }]}
          >
            Confirm your details before placing the order.
          </Text>
        </View>

        <View
          style={[
            styles.reviewCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.reviewHeader}>
            <Text style={[styles.reviewTitle, { color: colors.text }]}>
              Delivery Address
            </Text>
            <Pressable onPress={() => setStep('address')}>
              <Text style={[styles.editLink, { color: BRAND.primary }]}>
                Edit
              </Text>
            </Pressable>
          </View>
          <Text style={[styles.reviewText, { color: colors.textSecondary }]}>
            {address.firstName} {address.lastName}
          </Text>
          <Text style={[styles.reviewText, { color: colors.textSecondary }]}>
            {address.email}
          </Text>
          <Text style={[styles.reviewText, { color: colors.textSecondary }]}>
            {address.phone}
          </Text>
          <Text style={[styles.reviewText, { color: colors.textSecondary }]}>
            {address.address}, {address.city}, {address.state}
          </Text>
        </View>

        <View
          style={[
            styles.reviewCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.reviewHeader}>
            <Text style={[styles.reviewTitle, { color: colors.text }]}>
              Payment Method
            </Text>
            <Pressable onPress={() => setStep('payment')}>
              <Text style={[styles.editLink, { color: BRAND.primary }]}>
                Edit
              </Text>
            </Pressable>
          </View>
          <Text style={[styles.reviewText, { color: colors.textSecondary }]}>
            {PAYMENT_METHOD_LABELS[selectedPayment]}
          </Text>
        </View>

        <View
          style={[
            styles.reviewCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.reviewTitle, { color: colors.text }]}>
            Order Items ({items.length})
          </Text>
          {items.map((item) => (
            <View key={item.id} style={styles.orderItem}>
              <Text
                style={[styles.orderItemName, { color: colors.text }]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <Text
                style={[styles.orderItemQty, { color: colors.textSecondary }]}
              >
                x{item.quantity}
              </Text>
              <Text style={[styles.orderItemPrice, { color: colors.text }]}>
                {formatPrice(
                  (item.negotiatedPrice ?? item.price) * item.quantity
                )}
              </Text>
            </View>
          ))}
        </View>

        <View
          style={[
            styles.totalCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>
              Subtotal
            </Text>
            <Text style={[styles.totalValue, { color: colors.text }]}>
              {formatPrice(subtotal)}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>
              Delivery
            </Text>
            <Text style={[styles.totalValue, { color: colors.text }]}>
              {formatPrice(deliveryFee)}
            </Text>
          </View>
          {assuranceFee > 0 && (
            <View style={styles.totalRow}>
              <Text
                style={[styles.totalLabel, { color: colors.textSecondary }]}
              >
                Device Assurance
              </Text>
              <Text style={[styles.totalValue, { color: colors.text }]}>
                {formatPrice(assuranceFee)}
              </Text>
            </View>
          )}
          {orderTotals && getMerchantTaxRate(paymentSettings) > 0 && (
            <View style={styles.totalRow}>
              <Text
                style={[styles.totalLabel, { color: colors.textSecondary }]}
              >
                VAT ({(getMerchantTaxRate(paymentSettings) * 100).toFixed(1)}%)
              </Text>
              <Text style={[styles.totalValue, { color: colors.text }]}>
                {formatPrice(orderTotals.taxAmount)}
              </Text>
            </View>
          )}
          <View style={[styles.totalRow, styles.grandTotalRow]}>
            <Text style={[styles.grandTotalLabel, { color: colors.text }]}>
              Total
            </Text>
            <Text style={[styles.grandTotalValue, { color: BRAND.primary }]}>
              {formatPrice(total)}
            </Text>
          </View>
        </View>
      </ScrollView>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Checkout',
          headerLeft: () => (
            <Pressable onPress={handleBack} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
          ),
        }}
      />

      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.muted }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {renderStepIndicator()}

        {step === 'address' && renderAddressForm()}
        {step === 'payment' && renderPaymentOptions()}
        {step === 'review' && renderReview()}

        <SafeAreaView
          edges={['bottom']}
          style={[
            styles.bottomAction,
            { backgroundColor: colors.card, borderTopColor: colors.border },
          ]}
        >
          <View style={styles.bottomBar}>
            <View style={styles.bottomSummary}>
              <Text
                style={[styles.bottomLabel, { color: colors.textSecondary }]}
              >
                Total
              </Text>
              <Text style={[styles.bottomValue, { color: colors.text }]}>
                {formatPrice(displayTotal)}
              </Text>
              <Text
                style={[styles.bottomSubtle, { color: colors.textSecondary }]}
              >
                {items.length} item{items.length === 1 ? '' : 's'}
              </Text>
            </View>

            {step === 'review' ? (
              <Pressable
                style={[
                  styles.actionButton,
                  { backgroundColor: BRAND.primary },
                ]}
                onPress={handlePlaceOrder}
                disabled={isProcessing}
                accessibilityRole="button"
                accessibilityLabel={`Place order for ${formatPrice(total)}`}
                accessibilityState={{
                  disabled: isProcessing,
                  busy: isProcessing,
                }}
              >
                {isProcessing ? (
                  <View style={styles.processingContainer}>
                    <ActivityIndicator color="#FFFFFF" size="small" />
                    <Text style={styles.actionButtonText}>Processing...</Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.actionButtonText}>Place Order</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                  </>
                )}
              </Pressable>
            ) : (
              <Pressable
                style={[
                  styles.actionButton,
                  { backgroundColor: BRAND.primary },
                ]}
                onPress={handleContinue}
                accessibilityRole="button"
                accessibilityLabel={`Continue to ${step === 'address' ? 'payment' : 'review'}`}
              >
                <Text style={styles.actionButtonText}>Continue</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </Pressable>
            )}
          </View>
        </SafeAreaView>

        {/* State Picker */}
        <Modal
          visible={showStatePicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowStatePicker(false)}
        >
          <View style={styles.pickerOverlay}>
            <View
              style={[styles.pickerSheet, { backgroundColor: colors.card }]}
            >
              <View style={styles.pickerHeader}>
                <Text style={[styles.pickerTitle, { color: colors.text }]}>
                  Select State
                </Text>
                <Pressable
                  onPress={() => setShowStatePicker(false)}
                  hitSlop={12}
                >
                  <Ionicons
                    name="close"
                    size={22}
                    color={colors.textSecondary}
                  />
                </Pressable>
              </View>
              <FlatList
                data={shippingStates}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <Pressable
                    style={styles.pickerItem}
                    onPress={() => handleSelectState(item)}
                  >
                    <Text
                      style={[styles.pickerItemText, { color: colors.text }]}
                    >
                      {item}
                    </Text>
                  </Pressable>
                )}
                ListEmptyComponent={
                  <Text
                    style={[styles.helperText, { color: colors.textSecondary }]}
                  >
                    No states available.
                  </Text>
                }
              />
            </View>
          </View>
        </Modal>

        {/* City Picker */}
        <Modal
          visible={showCityPicker}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setShowCityPicker(false);
            setCitySearch('');
          }}
        >
          <View style={styles.pickerOverlay}>
            <View
              style={[styles.pickerSheet, { backgroundColor: colors.card }]}
            >
              <View style={styles.pickerHeader}>
                <Text style={[styles.pickerTitle, { color: colors.text }]}>
                  Select City
                </Text>
                <Pressable
                  onPress={() => {
                    setShowCityPicker(false);
                    setCitySearch('');
                  }}
                  hitSlop={12}
                >
                  <Ionicons
                    name="close"
                    size={22}
                    color={colors.textSecondary}
                  />
                </Pressable>
              </View>
              <View
                style={[
                  styles.citySearchContainer,
                  { borderColor: colors.border },
                ]}
              >
                <Ionicons
                  name="search"
                  size={16}
                  color={colors.textSecondary}
                />
                <TextInput
                  style={[styles.citySearchInput, { color: colors.text }]}
                  placeholder="Search or type your city..."
                  placeholderTextColor={colors.textSecondary}
                  value={citySearch}
                  onChangeText={setCitySearch}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="done"
                />
                {citySearch.length > 0 && (
                  <Pressable onPress={() => setCitySearch('')} hitSlop={8}>
                    <Ionicons
                      name="close-circle"
                      size={18}
                      color={colors.textSecondary}
                    />
                  </Pressable>
                )}
              </View>
              <FlatList
                data={
                  citySearch
                    ? shippingCities.filter((c) =>
                        c.toLowerCase().includes(citySearch.toLowerCase())
                      )
                    : shippingCities
                }
                keyExtractor={(item) => item}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <Pressable
                    style={styles.pickerItem}
                    onPress={() => handleSelectCity(item)}
                  >
                    <Text
                      style={[styles.pickerItemText, { color: colors.text }]}
                    >
                      {item}
                    </Text>
                  </Pressable>
                )}
                ListHeaderComponent={null}
                ListEmptyComponent={
                  !citySearch.trim() ? (
                    <Text
                      style={[
                        styles.helperText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      No cities available. Type your city above.
                    </Text>
                  ) : null
                }
              />
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>

      <CryptoSelectionModal
        visible={showCryptoSelection}
        onClose={() => setShowCryptoSelection(false)}
        onConfirm={(chain, currency) => {
          // Cast string types to strict union types is handled by internal logic or just pass string if API accepts string
          handleCryptoConfirm(chain, currency);
        }}
        isProcessing={isProcessing}
      />

      {/* Crypto Payment Modal */}
      {cryptoPayment && (
        <Modal visible animationType="slide" transparent={false}>
          <SafeAreaView
            style={[styles.container, { backgroundColor: colors.background }]}
          >
            {/* Header */}
            <View
              style={[styles.cryptoHeader, { backgroundColor: BRAND.primary }]}
            >
              <View style={styles.cryptoHeaderLeft}>
                <Pressable
                  onPress={() => {
                    setCryptoPayment(null);
                    setShowCryptoSelection(true);
                  }}
                  style={styles.cryptoBackBtn}
                  accessibilityLabel="Change network or coin"
                  accessibilityRole="button"
                >
                  <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
                </Pressable>
                <Text style={styles.cryptoHeaderTitle}>Pay with Crypto</Text>
              </View>
              <Pressable
                onPress={() => {
                  Alert.alert(
                    'Close Payment?',
                    "If you've already sent crypto, your order will still be processed once the payment is detected on the blockchain.",
                    [
                      { text: 'Stay', style: 'cancel' },
                      {
                        text: 'Close',
                        onPress: () => {
                          setCryptoPayment(null);
                        },
                      },
                    ]
                  );
                }}
                style={styles.cryptoCloseBtn}
              >
                <Ionicons name="close" size={18} color="#FFFFFF" />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.cryptoContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Amount */}
              <View
                style={[
                  styles.cryptoAmountCard,
                  { backgroundColor: colors.card },
                ]}
              >
                <Text
                  style={[
                    styles.cryptoAmountLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  Send Exactly
                </Text>
                <Text
                  style={[styles.cryptoAmountValue, { color: colors.text }]}
                >
                  {cryptoPayment.cryptoAmount ||
                    (cryptoPayment.amount / 100).toLocaleString()}{' '}
                  <Text style={{ color: BRAND.primary }}>
                    {cryptoPayment.currency}
                  </Text>
                </Text>
                <View style={styles.cryptoChainBadge}>
                  <View style={styles.cryptoPulseDot} />
                  <Text style={styles.cryptoChainText}>
                    Network:{' '}
                    {{
                      TRX: 'Tron (TRC-20)',
                      ETH: 'Ethereum (ERC-20)',
                      MATIC: 'Polygon',
                      AVAXC: 'Avalanche C-Chain',
                    }[cryptoPayment.chain] || cryptoPayment.chain}
                  </Text>
                </View>
              </View>

              {/* Wallet Address */}
              <View
                style={[
                  styles.cryptoAddressCard,
                  { backgroundColor: colors.card },
                ]}
              >
                <Text style={styles.cryptoFieldLabel}>RECIPIENT ADDRESS</Text>
                <View style={styles.cryptoAddressRow}>
                  <Text
                    style={[styles.cryptoAddressText, { color: colors.text }]}
                    selectable
                    numberOfLines={2}
                  >
                    {cryptoPayment.address}
                  </Text>
                  <Pressable
                    style={[
                      styles.cryptoCopyBtn,
                      {
                        backgroundColor:
                          copiedCryptoField === 'address'
                            ? `${palette.emerald[500]}15`
                            : `${BRAND.primary}15`,
                      },
                    ]}
                    onPress={async () => {
                      const success = await setClipboardString(
                        cryptoPayment.address
                      );
                      if (success) {
                        setCopiedCryptoField('address');
                        if (cryptoCopyTimerRef.current)
                          clearTimeout(cryptoCopyTimerRef.current);
                        cryptoCopyTimerRef.current = setTimeout(
                          () => setCopiedCryptoField(null),
                          2000
                        );
                      }
                    }}
                  >
                    <Ionicons
                      name={
                        copiedCryptoField === 'address'
                          ? 'checkmark'
                          : 'copy-outline'
                      }
                      size={18}
                      color={
                        copiedCryptoField === 'address'
                          ? '#059669'
                          : BRAND.primary
                      }
                    />
                  </Pressable>
                </View>
              </View>

              {/* Warning */}
              <View style={styles.cryptoWarning}>
                <Ionicons name="warning" size={18} color="#F59E0B" />
                <Text style={styles.cryptoWarningText}>
                  Only send {cryptoPayment.currency} on the{' '}
                  {cryptoPayment.chain} network. Using the wrong network will
                  result in permanent loss.
                </Text>
              </View>

              {/* Confirmation Time */}
              {cryptoPayment.confirmationTime ? (
                <View
                  style={[
                    styles.cryptoInfoCard,
                    { backgroundColor: `${BRAND.primary}10` },
                  ]}
                >
                  <Ionicons
                    name="time-outline"
                    size={18}
                    color={BRAND.primary}
                  />
                  <Text
                    style={[
                      styles.cryptoInfoText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Expected confirmation: {cryptoPayment.confirmationTime}
                  </Text>
                </View>
              ) : null}

              {/* Reference */}
              {cryptoPayment.reference ? (
                <Text
                  style={[
                    styles.cryptoReference,
                    { color: colors.textSecondary },
                  ]}
                >
                  Ref: {cryptoPayment.reference}
                </Text>
              ) : null}
            </ScrollView>

            {/* Bottom Action */}
            <View
              style={[
                styles.cryptoBottomAction,
                {
                  backgroundColor: colors.card,
                  borderTopColor: colors.border,
                },
              ]}
            >
              <Pressable
                style={[
                  styles.cryptoDoneBtn,
                  { backgroundColor: BRAND.primary },
                ]}
                onPress={() => {
                  clearCart();
                  // Capture all needed values BEFORE nullifying to avoid stale reference
                  const { orderId, orderNumber, trackingToken } = cryptoPayment;
                  setCryptoPayment(null);
                  router.replace({
                    pathname: '/order-success',
                    params: {
                      orderId,
                      orderNumber,
                      paymentMethod: 'juicyway',
                      ...(trackingToken && { trackingToken }),
                    },
                  });
                }}
              >
                <Text style={styles.cryptoDoneBtnText}>
                  I've Sent the Payment
                </Text>
              </Pressable>
              <Text
                style={[styles.cryptoHelpText, { color: colors.textSecondary }]}
              >
                Tap above after sending. Your order will be confirmed once the
                payment is detected on the blockchain.
              </Text>
            </View>
          </SafeAreaView>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backBtn: {
    padding: 10,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepIndicator: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  stepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  stepBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.red[50],
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  stepBadgeText: {
    fontSize: 12,
    color: BRAND.primary,
    fontWeight: '600',
  },
  stepSubtitle: {
    fontSize: 13,
    marginBottom: SPACING.sm,
  },
  stepProgress: {
    height: 6,
    borderRadius: 999,
    backgroundColor: palette.gray[200],
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  stepProgressActive: {
    height: 6,
    backgroundColor: BRAND.primary,
  },
  stepPills: {
    flexDirection: 'row',
    gap: 8,
  },
  stepPill: {
    flex: 1,
    borderWidth: 1,
    borderRadius: RADIUS.xl,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  stepPillDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepPillNumber: {
    fontSize: 12,
    fontWeight: '700',
  },
  stepPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: SPACING.md,
  },
  formContent: {
    paddingBottom: 140,
  },
  sectionHeader: {
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 13,
    marginTop: 6,
  },
  card: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: SPACING.sm,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardBody: {
    gap: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  selectInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  helperText: {
    fontSize: 12,
  },
  quoteRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quoteInfo: {
    flex: 1,
    marginRight: 12,
  },
  quoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  quoteTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  quoteMeta: {
    fontSize: 12,
  },
  quoteRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  quotePrice: {
    fontSize: 14,
    fontWeight: '700',
  },
  quoteBadge: {
    backgroundColor: '#DBEAFE',
    borderRadius: RADIUS.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  quoteBadgeDark: {
    backgroundColor: '#111827',
    borderRadius: RADIUS.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  quoteBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  quoteLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reviewTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  editLink: {
    fontSize: 14,
    fontWeight: '500',
  },
  reviewText: {
    fontSize: 14,
    lineHeight: 22,
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  orderItemName: {
    flex: 1,
    fontSize: 14,
  },
  orderItemQty: {
    fontSize: 13,
    marginHorizontal: 12,
  },
  orderItemPrice: {
    fontSize: 14,
    fontWeight: '600',
  },
  totalCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 100,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  totalLabel: {
    fontSize: 14,
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginTop: 8,
    paddingTop: 16,
  },
  grandTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  grandTotalValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  bottomAction: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACING.md,
    borderTopWidth: 1,
    ...SHADOWS.lg,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bottomSummary: {
    minWidth: 120,
  },
  bottomLabel: {
    fontSize: 11,
    color: palette.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  bottomValue: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.gray[900],
  },
  bottomSubtle: {
    fontSize: 12,
    marginTop: 2,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: RADIUS.xl,
    flex: 1,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fieldError: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '70%',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  pickerItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  pickerItemText: {
    fontSize: 14,
  },
  citySearchContainer: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  citySearchInput: {
    flex: 1,
    fontSize: 14,
  },
  retryCard: {
    borderWidth: 2,
    borderColor: '#FCD34D',
    borderStyle: 'dashed',
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 10,
  },
  retryIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryTextWrap: {
    alignItems: 'center',
  },
  retryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  retrySubtitle: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 4,
    textAlign: 'center',
  },
  retryBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  retryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  saveDetailsSection: {
    gap: SPACING.sm,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
    minHeight: 44,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: BRAND.primary,
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  accountInfoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
  },
  accountInfoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },

  // Crypto payment modal styles
  cryptoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  cryptoHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  cryptoHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cryptoBackBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cryptoCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cryptoContent: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  cryptoAmountCard: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    gap: 4,
  },
  cryptoAmountLabel: {
    fontSize: 13,
  },
  cryptoAmountValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  cryptoChainBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
  },
  cryptoPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
  },
  cryptoChainText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  cryptoAddressCard: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    gap: SPACING.sm,
  },
  cryptoFieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.5,
  },
  cryptoAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  cryptoAddressText: {
    flex: 1,
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 20,
  },
  cryptoCopyBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cryptoWarning: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: '#FFF8E1',
  },
  cryptoWarningText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
  },
  cryptoInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
  },
  cryptoInfoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  cryptoReference: {
    textAlign: 'center',
    fontSize: 12,
  },
  cryptoBottomAction: {
    padding: SPACING.lg,
    borderTopWidth: 1,
    gap: SPACING.sm,
  },
  cryptoDoneBtn: {
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  cryptoDoneBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cryptoHelpText: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 16,
  },
});
