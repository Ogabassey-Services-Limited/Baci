/**
 * Checkout Screen
 * Multi-step checkout: Address -> Payment -> Confirmation
 */

import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import Constants from 'expo-constants';
import { router, Stack } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
  type Control,
  Controller,
  type FieldErrors,
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
import type { z } from 'zod';
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
import { type TextContentType, TextContentTypes } from '@/hooks/use-keyboard';
import { calculateCommerce } from '@/lib/supabase';
import { ShippingAddressSchema } from '@/lib/validation';
import {
  trackCheckoutStarted,
  trackCheckoutStep,
  trackError,
  trackOrderCompleted,
} from '@/services/analytics';
import { createOrder, OrderError } from '@/services/orders';
import { scheduleLocalNotification } from '@/services/push-notifications';
import { type Customer, useAuthStore } from '@/stores/auth-store';
import { type CartItem, formatPrice, useCartStore } from '@/stores/cart-store';

type CheckoutStep = 'address' | 'payment' | 'review';

type ShippingAddressInput = z.infer<typeof ShippingAddressSchema>;

type ThemeColors = (typeof Colors)[keyof typeof Colors];

type TextInputAutoComplete = React.ComponentProps<
  typeof TextInput
>['autoComplete'];

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

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.apiUrl ||
  'https://ogabassey.usebaci.com';

const PAYMENT_METHOD_LABELS: Record<PaymentMethodType, string> = {
  paystack: 'Card Payment (Paystack)',
  korapay: 'Card Payment (Korapay)',
  bank_transfer: 'Bank Transfer',
  pay_on_delivery: 'Pay on Delivery',
  credpal: 'CredPal (Buy Now Pay Later)',
  credit_direct: 'Credit Direct (Installments)',
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
  firstName: TextContentTypes.givenName,
  lastName: TextContentTypes.familyName,
  phone: TextContentTypes.telephoneNumber,
  address: TextContentTypes.fullStreetAddress,
  city: TextContentTypes.addressCity,
};

const AUTO_COMPLETE_MAP: Partial<
  Record<keyof ShippingAddressInput, TextInputAutoComplete>
> = {
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

/**
 * Regex that matches characters forbidden in name fields (digits + whitespace).
 * Used by blockDigits to strip these before they can render.
 */
const BLOCKED_NAME_CHARS = /[\d\s]/g;

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
  blockDigits = false,
  maxLength,
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
  blockDigits?: boolean;
  maxLength?: number;
}) {
  const inputRef = useRef<TextInput>(null);

  return (
    <View style={[styles.inputGroup, containerStyle]}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            ref={inputRef}
            style={[
              styles.input,
              multiline && styles.multilineInput,
              { backgroundColor: colors.card, color: colors.text },
              { borderColor: errors[name] ? '#EF4444' : colors.border },
            ]}
            value={typeof value === 'string' ? value : ''}
            onChangeText={(text) => {
              const currentValue = typeof value === 'string' ? value : '';
              let processed = transformText
                ? transformText(text, currentValue)
                : text;

              if (blockDigits) {
                // Strip digits and spaces before they can render
                processed = processed.replace(BLOCKED_NAME_CHARS, '');
                // Immediately revert native text if anything was stripped
                if (processed !== text) {
                  inputRef.current?.setNativeProps({ text: processed });
                }
              }

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
            returnKeyType={multiline ? 'default' : returnKeyType}
            blurOnSubmit={!multiline}
            onSubmitEditing={onSubmitEditing}
          />
        )}
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
  setIsLoadingQuotes: (value: boolean) => void;
  setSelectedQuoteId: (value: string) => void;
  setShippingQuotes: (value: ShippingQuote[]) => void;
  setShippingDebug: (
    value: {
      apiUrl: string;
      status: number | null;
      ok: boolean;
      quotes: number;
      warnings?: string[];
      error?: string;
    } | null
  ) => void;
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
  setIsLoadingQuotes,
  setSelectedQuoteId,
  setShippingQuotes,
  setShippingDebug,
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
          email: customer?.email || 'guest@example.com',
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
          value: item.negotiatedPrice || item.price,
        })),
      }),
    });

    if (res.ok) {
      const data: QuoteResponse & { warnings?: string[] } = await res.json();
      const quotes = data.quotes?.all || [];
      setShippingQuotes(quotes);
      setShippingDebug({
        apiUrl,
        status: res.status,
        ok: true,
        quotes: quotes.length,
        warnings: data.warnings,
      });

      if (quotes.length > 0) {
        const cheapest = quotes.reduce((prev, current) =>
          prev.price <= current.price ? prev : current
        );
        setSelectedQuoteId(String(cheapest.id));
      }
    } else {
      const errorText = await res.text();
      setShippingQuotes([]);
      setShippingDebug({
        apiUrl,
        status: res.status,
        ok: false,
        quotes: 0,
        error: errorText.slice(0, 300),
      });
    }
  } catch (_error) {
    setShippingQuotes([]);
    setShippingDebug({
      apiUrl,
      status: null,
      ok: false,
      quotes: 0,
      error: _error instanceof Error ? _error.message : 'Unknown error',
    });
  } finally {
    setIsLoadingQuotes(false);
  }
};

export default function CheckoutScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const items = useCartStore((state) => state.items);
  const subtotal = useCartStore((state) => state.subtotal());
  const clearCart = useCartStore((state) => state.clearCart);
  const customer = useAuthStore((state) => state.customer);

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
  const [_shippingDebug, setShippingDebug] = React.useState<{
    apiUrl: string;
    status: number | null;
    ok: boolean;
    quotes: number;
    warnings?: string[];
    error?: string;
  } | null>(null);
  const [selectedQuoteId, setSelectedQuoteId] = React.useState<string>('');
  const [isLoadingLocations, setIsLoadingLocations] = React.useState(false);
  const [isLoadingCities, setIsLoadingCities] = React.useState(false);
  const [isLoadingQuotes, setIsLoadingQuotes] = React.useState(false);
  const [showStatePicker, setShowStatePicker] = React.useState(false);
  const [showCityPicker, setShowCityPicker] = React.useState(false);
  const [citySearch, setCitySearch] = React.useState('');

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
    getValues,
    setValue,
  } = useForm<ShippingAddressInput>({
    // Cast to any for Zod 4 compatibility with @hookform/resolvers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(ShippingAddressSchema as any),
    defaultValues: {
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

  const hasTrackedStart = useRef(false);
  const isOrderInFlight = useRef(false);
  // Sentinel: stores the city Google Places suggested, so we can match it
  // against the Topship cities list once they load.
  // null = no pending suggestion, '' = state=city edge case (open picker)
  const googleSuggestedCityRef = useRef<string | null>(null);

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

  const handleBack = () => {
    if (step === 'payment') {
      setStep('address');
    } else if (step === 'review') {
      setStep('payment');
    } else {
      router.back();
    }
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
                onPress: () => router.back(),
              },
            ]
          );
          return true;
        }
        handleBack();
        return true;
      }
    );

    return () => backHandler.remove();
  }, [step, handleBack]);

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
    setShippingCities([]);
    setIsLoadingCities(true);
    const fetchCities = async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/shipping/locations?state=${encodeURIComponent(
            watchedState
          )}`
        );
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
        setShippingCities([]);
      } finally {
        setIsLoadingCities(false);
      }
    };
    fetchCities();
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
        setIsLoadingQuotes,
        setSelectedQuoteId,
        setShippingQuotes,
        setShippingDebug,
      });
    } else {
      setShippingQuotes([]);
      setSelectedQuoteId('');
    }
  }, [
    watchedState,
    watchedCity,
    items,
    customer,
    watchedFirstName,
    watchedLastName,
    watchedPhone,
    watchedAddress,
  ]);

  const selectedQuote = shippingQuotes.find(
    (quote) => String(quote.id) === String(selectedQuoteId)
  );
  const deliveryFee = selectedQuote?.price ?? 0;

  useEffect(() => {
    const fetchTotals = async () => {
      try {
        const result = await calculateCommerce('calculate_order', {
          subtotal,
          shippingFee: deliveryFee,
          taxRate: 0.075,
        });
        setOrderTotals(result);
      } catch {
        // Silent fail
      }
    };
    fetchTotals();
  }, [subtotal, deliveryFee]);

  const total = orderTotals?.total || subtotal + deliveryFee;

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

  const handlePlaceOrder = async () => {
    if (isOrderInFlight.current || isProcessing) {
      return;
    }

    isOrderInFlight.current = true;
    setIsProcessing(true);

    if (items.length === 0) {
      isOrderInFlight.current = false;
      setIsProcessing(false);
      Alert.alert(
        'Empty Cart',
        'Your cart is empty. Please add items before checking out.',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]
      );
      return;
    }

    try {
      trackCheckoutStep('review');

      const address = getValues();
      const customerEmail = customer?.email || '';
      const customerPhone = address.phone;
      const customerName = `${address.firstName} ${address.lastName}`;

      const isBNPL =
        selectedPayment === 'credpal' || selectedPayment === 'credit_direct';

      if (isBNPL) {
        const orderResponse = await createOrder({
          customer_email: customerEmail,
          customer_name: customerName,
          customer_phone: customerPhone,
          items: items.map((item) => ({
            id: item.id,
            product_id: item.id,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            image_url: item.image_url,
          })),
          subtotal,
          shipping_fee: deliveryFee,
          tax_amount: orderTotals?.taxAmount || 0,
          payment_method: selectedPayment,
          shipping_address: address,
          source: 'mobile_app',
        });

        router.push({
          pathname: '/bnpl-checkout',
          params: {
            orderId: orderResponse.order.id,
            gateway: selectedPayment,
            amount: String(orderResponse.amountDueToGateway),
            customerEmail,
            customerName,
            customerPhone,
            merchantSlug: 'ogabassey',
          },
        });
        setIsProcessing(false);
        return;
      }

      const orderResponse = await createOrder({
        customer_email: customerEmail,
        customer_name: customerName,
        customer_phone: customerPhone,
        items: items.map((item) => ({
          id: item.id,
          product_id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          image_url: item.image_url,
        })),
        subtotal,
        shipping_fee: deliveryFee,
        tax_amount: orderTotals?.taxAmount || 0,
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
        subtotal,
        shipping: deliveryFee,
        tax: orderTotals?.taxAmount,
        currency: 'NGN',
        itemCount: items.reduce((acc, item) => acc + item.quantity, 0),
        paymentMethod: selectedPayment,
      });

      await scheduleLocalNotification(
        'Order Received! 📦',
        `Your order #${orderNumber} is being processed. We'll notify you when it ships.`,
        { type: 'order_update', orderNumber, orderId: order.id },
        1
      );

      clearCart();

      router.replace({
        pathname: '/order-success',
        params: {
          orderId: order.id,
          orderNumber,
        },
      });
    } catch (error) {
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
                blockDigits
                maxLength={50}
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
                blockDigits
                maxLength={50}
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
                    setIsLoadingQuotes,
                    setSelectedQuoteId,
                    setShippingQuotes,
                    setShippingDebug,
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
                {formatPrice(item.price * item.quantity)}
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
          {orderTotals && (
            <View style={styles.totalRow}>
              <Text
                style={[styles.totalLabel, { color: colors.textSecondary }]}
              >
                VAT (7.5%)
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
                {formatPrice(total)}
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
});
