/**
 * Checkout Screen
 * Multi-step checkout: Address -> Payment -> Confirmation
 */

import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { router, Stack } from 'expo-router';
import React, { useEffect, useEffectEvent, useRef } from 'react';
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
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { getAddressLabelIcon } from '@/components/addresses/get-address-label-icon';
import {
  type CheckoutStep,
  CheckoutStepper,
} from '@/components/checkout/CheckoutStepper';
import { CryptoSelectionModal } from '@/components/checkout/CryptoSelectionModal';
import { DeliveryMethodCard } from '@/components/checkout/DeliveryMethodCard';
import { DeliveryNotesCard } from '@/components/checkout/DeliveryNotesCard';
import {
  PaymentMethodSelector,
  type PaymentMethodType,
  type PaymentTab,
} from '@/components/checkout/PaymentMethodSelector';
import {
  PICKUP_STATION_ADDRESS_LINES,
  PICKUP_STATION_CITY,
  PICKUP_STATION_STATE,
  PickupStationCard,
} from '@/components/checkout/PickupStationCard';
import { ShippingQuotesCard } from '@/components/checkout/ShippingQuotesCard';
import type {
  DeliveryMethod,
  ShippingQuote,
} from '@/components/checkout/types';
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
import { resolveApiBaseUrl } from '@/lib/api-url';
import { deriveCheckoutIdentity } from '@/lib/checkout-identity';
import {
  getDefaultSavedAddress,
  type SavedAddress,
  toCheckoutAddressValues,
  upsertSavedAddress,
} from '@/lib/checkout-saved-address';
import { setClipboardString } from '@/lib/clipboard';
import {
  buildShippingQuoteContextKey,
  getPreferredShippingQuoteId,
  normalizeShippingQuotes,
} from '@/lib/shipping-quotes';
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
import type { Customer } from '@/stores/auth-store';
import { type CartItem, formatPrice, useCartStore } from '@/stores/cart-store';

type ThemeColors = (typeof Colors)[keyof typeof Colors];

type TextInputAutoComplete = React.ComponentProps<
  typeof TextInput
>['autoComplete'];

const shippingAddressResolver = zodResolver(
  ShippingAddressSchema as unknown as Parameters<typeof zodResolver>[0]
) as unknown as Resolver<ShippingAddressInput>;

interface QuoteResponse {
  quotes: {
    all: ShippingQuote[];
  };
}

interface ShippingLocation {
  state: string;
  city: string;
}

const AIRPORT_DELIVERY_FEE = 25000;

interface PendingCryptoOrder {
  order: OrderResponse['order'];
  orderResponse: OrderResponse;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  trackingToken?: string;
}

const API_BASE_URL = resolveApiBaseUrl(
  process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl
);

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
  invoice: 'Generate Invoice',
  payforme: 'Pay for Me',
};

function getPaymentTabForMethod(method: PaymentMethodType): PaymentTab {
  if (method === 'credpal' || method === 'credit_direct') {
    return 'installments';
  }
  if (method === 'invoice' || method === 'payforme') {
    return 'pay_later';
  }
  return 'full';
}

function getDeliveryMethodFee(
  deliveryMethod: DeliveryMethod,
  selectedQuote: ShippingQuote | undefined
) {
  if (deliveryMethod === 'airport') return AIRPORT_DELIVERY_FEE;
  if (deliveryMethod === 'pickup_station') return 0;
  return selectedQuote?.price ?? 0;
}

function getDeliveryMethodLabel(deliveryMethod: DeliveryMethod) {
  switch (deliveryMethod) {
    case 'airport':
      return 'Airport Delivery';
    case 'pickup_station':
      return 'Pick Up Station';
    default:
      return 'Door Delivery';
  }
}

function getDeliveryMethodSummary(
  deliveryMethod: DeliveryMethod,
  selectedQuote: ShippingQuote | undefined
) {
  if (deliveryMethod === 'airport') {
    return 'Est Delivery within 24-48 working hours';
  }
  if (deliveryMethod === 'pickup_station') {
    return PICKUP_STATION_ADDRESS_LINES.join(', ');
  }

  const carrier =
    selectedQuote?.carrierName || selectedQuote?.provider || 'Topship';
  const eta =
    selectedQuote?.deliveryRange ||
    (selectedQuote?.estimatedDays
      ? `${selectedQuote.estimatedDays} days`
      : 'Delivery estimate shown after selection');

  return `${carrier} • ${eta}`;
}

function getShippingProviderForMethod(
  deliveryMethod: DeliveryMethod,
  selectedQuote: ShippingQuote | undefined
) {
  if (deliveryMethod === 'airport') return 'Airport Delivery';
  if (deliveryMethod === 'pickup_station') return 'Pick Up Station';
  return selectedQuote?.provider || selectedQuote?.carrierName || undefined;
}

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

function humanizeCheckoutFieldName(field: keyof ShippingAddressInput): string {
  switch (field) {
    case 'firstName':
      return 'first name';
    case 'lastName':
      return 'last name';
    case 'phone':
      return 'phone number';
    case 'email':
      return 'email address';
    case 'address':
      return 'delivery address';
    case 'city':
      return 'city';
    case 'state':
      return 'state';
    case 'notes':
      return 'delivery notes';
    default:
      return field;
  }
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
  const [isFocused, setIsFocused] = React.useState(false);
  const isDark = colors.text === '#FFFFFF' || colors.background === '#111827';

  return (
    <View style={[styles.inputGroup, containerStyle]}>
      {label ? (
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {label}
        </Text>
      ) : null}
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
                {
                  backgroundColor: isDark
                    ? 'rgba(255, 255, 255, 0.05)'
                    : colors.muted,
                  color: colors.text,
                  borderColor: errors[name]
                    ? colors.error
                    : isFocused
                      ? BRAND.primary
                      : colors.border,
                },
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
              onFocus={() => setIsFocused(true)}
              onBlur={() => {
                setIsFocused(false);
                onBlur();
              }}
              maxLength={maxLength}
              placeholder={placeholder}
              placeholderTextColor={colors.placeholder}
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
  setResolvedShippingQuoteContextKey: (value: string) => void;
  setShippingQuotes: (value: ShippingQuote[]) => void;
  previousSelectedQuoteId?: string | null;
  quoteContextKey: string;
  shouldResetSelection: boolean;
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
  setResolvedShippingQuoteContextKey,
  setShippingQuotes,
  previousSelectedQuoteId,
  quoteContextKey,
  shouldResetSelection,
  signal,
}: FetchQuotesArgs) => {
  if (!state || !city || items.length === 0) return;

  setIsLoadingQuotes(true);
  if (shouldResetSelection) {
    setShippingQuotes([]);
    setSelectedQuoteId('');
    setResolvedShippingQuoteContextKey('');
  }

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
      const quotes = normalizeShippingQuotes(data.quotes?.all || []);
      setShippingQuotes(quotes);
      setResolvedShippingQuoteContextKey(quoteContextKey);
      setSelectedQuoteId(
        getPreferredShippingQuoteId(quotes, previousSelectedQuoteId)
      );
    } else if (shouldResetSelection) {
      setShippingQuotes([]);
      setSelectedQuoteId('');
      setResolvedShippingQuoteContextKey('');
    }
  } catch (_error) {
    // Don't update state if the request was aborted (superseded by a newer request)
    if (signal?.aborted) return;
    if (shouldResetSelection) {
      setShippingQuotes([]);
      setSelectedQuoteId('');
      setResolvedShippingQuoteContextKey('');
    }
  } finally {
    // Don't clear loading state if aborted — the newer request owns loading state
    if (!signal?.aborted) {
      setIsLoadingQuotes(false);
    }
  }
};

export default function CheckoutScreen() {
  const ctaArrowTranslateX = useSharedValue(0);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = (colorScheme ?? 'light') === 'dark';
  const insets = useSafeAreaInsets();
  const addressScrollRef = React.useRef<ScrollView>(null);
  const addressScrollOffsetRef = React.useRef(0);

  const items = useCartStore((state) => state.items);
  const subtotal = useCartStore((state) => state.subtotal());
  const clearCart = useCartStore((state) => state.clearCart);
  const { customer, isAuthenticated, user } = useAuthStatus();
  const checkoutIdentity = deriveCheckoutIdentity({ customer, user });
  const checkoutEmail = checkoutIdentity.email;
  const checkoutFirstName = checkoutIdentity.firstName;
  const checkoutLastName = checkoutIdentity.lastName;
  const checkoutPhone = checkoutIdentity.phone;

  const { data: paymentSettings } = useMerchantPaymentSettings();
  const enabledPaymentMethods = getEnabledPaymentMethods(paymentSettings);
  const availablePaymentMethods: PaymentMethodType[] = Array.from(
    new Set<PaymentMethodType>([
      ...enabledPaymentMethods,
      'invoice',
      'payforme',
    ])
  );

  const [step, setStep] = React.useState<CheckoutStep>('address');
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [orderTotals, setOrderTotals] = React.useState<{
    total: number;
    taxAmount: number;
  } | null>(null);
  const [selectedPayment, setSelectedPayment] =
    React.useState<PaymentMethodType>('paystack');
  const [paymentTab, setPaymentTab] = React.useState<PaymentTab>('full');
  const [deliveryMethod, setDeliveryMethod] =
    React.useState<DeliveryMethod>('door');
  const savedDoorAddressRef = React.useRef<{
    address: string;
    city: string;
    state: string;
  } | null>(null);

  const [shippingStates, setShippingStates] = React.useState<string[]>([]);
  const [shippingCities, setShippingCities] = React.useState<string[]>([]);
  const [shippingQuotes, setShippingQuotes] = React.useState<ShippingQuote[]>(
    []
  );
  const [selectedQuoteId, setSelectedQuoteId] = React.useState<string>('');
  const [resolvedShippingQuoteContextKey, setResolvedShippingQuoteContextKey] =
    React.useState('');
  const [isLoadingLocations, setIsLoadingLocations] = React.useState(false);
  const [isLoadingCities, setIsLoadingCities] = React.useState(false);
  const [isLoadingQuotes, setIsLoadingQuotes] = React.useState(false);
  const [showStatePicker, setShowStatePicker] = React.useState(false);
  const [showCityPicker, setShowCityPicker] = React.useState(false);
  const [citySearch, setCitySearch] = React.useState('');
  const [citySearchFocused, setCitySearchFocused] = React.useState(false);
  const [saveDetails, setSaveDetails] = React.useState(false);
  const [saveAsDefaultAddress, setSaveAsDefaultAddress] = React.useState(false);
  const [savedAddresses, setSavedAddresses] = React.useState<SavedAddress[]>(
    []
  );
  const [selectedSavedAddressId, setSelectedSavedAddressId] = React.useState<
    string | null
  >(null);
  const [isAddingNewAddress, setIsAddingNewAddress] = React.useState(false);
  const [isLoadingSavedAddresses, setIsLoadingSavedAddresses] =
    React.useState(false);
  const [isContactCollapsed, setIsContactCollapsed] = React.useState(false);
  const [isDeliveryCollapsed, setIsDeliveryCollapsed] = React.useState(false);
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
      email: checkoutEmail,
      firstName: checkoutFirstName,
      lastName: checkoutLastName,
      phone: checkoutPhone,
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

  // committedAddress is set when the user picks an autocomplete suggestion or
  // loads a saved address. Only committed addresses drive re-fetches — using
  // watchedAddress here would trigger a new API call on every keystroke.
  const [committedAddress, setCommittedAddress] = React.useState('');
  const effectiveAddress = committedAddress;
  const currentShippingQuoteContextKey = buildShippingQuoteContextKey(
    watchedState,
    watchedCity,
    items,
    effectiveAddress
  );

  const hasTrackedStart = useRef(false);
  const isOrderInFlight = useRef(false);
  const hasHydratedSavedAddressRef = useRef(false);
  // Sentinel: stores the city Google Places suggested, so we can match it
  // against the Topship cities list once they load.
  // null = no pending suggestion, '' = state=city edge case (open picker)
  const googleSuggestedCityRef = useRef<string | null>(null);
  // AbortController for shipping quote requests — prevents race conditions
  // when multiple requests fire (e.g. rapid city/state changes)
  const shippingQuoteAbortRef = useRef<AbortController | null>(null);
  // Timer ref for crypto copy feedback — prevents setState after unmount
  const cryptoCopyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shippingQuoteReceiverRef = useRef({
    customer,
    watchedFirstName,
    watchedLastName,
    watchedPhone,
    watchedAddress,
    watchedEmail,
  });

  shippingQuoteReceiverRef.current = {
    customer,
    watchedFirstName,
    watchedLastName,
    watchedPhone,
    watchedAddress,
    watchedEmail,
  };
  const selectedQuoteIdRef = useRef(selectedQuoteId);
  selectedQuoteIdRef.current = selectedQuoteId;
  const hasSavedAddresses = isAuthenticated && savedAddresses.length > 0;
  const hasContactIdentity = Boolean(
    checkoutEmail && checkoutFirstName && checkoutLastName && checkoutPhone
  );
  const initialHasContactIdentityRef = useRef(hasContactIdentity);
  const formContentPaddingBottom = 116 + insets.bottom;
  const selectedSavedAddress =
    savedAddresses.find((item) => item.id === selectedSavedAddressId) ?? null;
  const defaultSavedAddress = getDefaultSavedAddress(savedAddresses);

  const applySavedAddressToForm = (
    savedAddress: SavedAddress,
    options?: { collapse?: boolean }
  ) => {
    const checkoutValues = toCheckoutAddressValues(savedAddress);

    setValue('firstName', checkoutValues.firstName, { shouldValidate: true });
    setValue('lastName', checkoutValues.lastName, { shouldValidate: true });
    setValue('phone', checkoutValues.phone, { shouldValidate: true });
    setValue('address', checkoutValues.address, { shouldValidate: true });
    setValue('city', checkoutValues.city, { shouldValidate: true });
    setValue('state', checkoutValues.state, { shouldValidate: true });
    setCommittedAddress(checkoutValues.address);
    setSelectedSavedAddressId(savedAddress.id);
    setIsAddingNewAddress(false);
    setSaveAsDefaultAddress(Boolean(savedAddress.is_default));

    if (options?.collapse !== false) {
      setIsContactCollapsed(true);
      setIsDeliveryCollapsed(true);
    }
  };

  // Cleanup crypto copy timer on unmount
  useEffect(() => {
    return () => {
      if (cryptoCopyTimerRef.current) clearTimeout(cryptoCopyTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const fetchAndHydrate = async () => {
      if (!isAuthenticated || !customer?.id) {
        setSavedAddresses([]);
        setSelectedSavedAddressId(null);
        setIsAddingNewAddress(true);
        setIsLoadingSavedAddresses(false);
        setIsContactCollapsed(false);
        setIsDeliveryCollapsed(false);
        setSaveAsDefaultAddress(false);
        hasHydratedSavedAddressRef.current = false;
        return;
      }

      setIsLoadingSavedAddresses(true);

      const nextAddresses = await (async (): Promise<SavedAddress[]> => {
        try {
          const { data, error } = await supabase
            .from('customers')
            .select('saved_addresses')
            .eq('id', customer.id)
            .eq('merchant_id', MERCHANT_ID)
            .single();

          if (error) throw error;

          const addresses = Array.isArray(data?.saved_addresses)
            ? ([...data.saved_addresses] as SavedAddress[])
            : [];

          addresses.sort(
            (left, right) =>
              Number(Boolean(right.is_default)) -
              Number(Boolean(left.is_default))
          );
          return addresses;
        } catch (error) {
          trackError(
            'checkout_saved_addresses_fetch',
            error instanceof Error
              ? error.message
              : 'Failed to load saved addresses'
          );
          return [];
        }
      })();
      setSavedAddresses(nextAddresses);
      setIsLoadingSavedAddresses(false);

      // Hydrate form with default saved address after fetch completes
      if (hasHydratedSavedAddressRef.current) return;

      const defaultAddr = getDefaultSavedAddress(nextAddresses);

      if (!defaultAddr) {
        setIsContactCollapsed(initialHasContactIdentityRef.current);
        setIsDeliveryCollapsed(false);
        setIsAddingNewAddress(true);
        setSaveAsDefaultAddress(true);
        hasHydratedSavedAddressRef.current = true;
        return;
      }

      const checkoutValues = toCheckoutAddressValues(defaultAddr);
      setValue('firstName', checkoutValues.firstName, { shouldValidate: true });
      setValue('lastName', checkoutValues.lastName, { shouldValidate: true });
      setValue('phone', checkoutValues.phone, { shouldValidate: true });
      setValue('address', checkoutValues.address, { shouldValidate: true });
      setValue('city', checkoutValues.city, { shouldValidate: true });
      setValue('state', checkoutValues.state, { shouldValidate: true });
      setSelectedSavedAddressId(defaultAddr.id);
      setIsAddingNewAddress(false);
      setSaveAsDefaultAddress(Boolean(defaultAddr.is_default));
      setCommittedAddress(checkoutValues.address);
      setIsContactCollapsed(true);
      setIsDeliveryCollapsed(true);
      hasHydratedSavedAddressRef.current = true;
    };

    fetchAndHydrate();
  }, [customer?.id, isAuthenticated, setValue]);

  useEffect(() => {
    if (!hasSavedAddresses) {
      setIsAddingNewAddress(true);
      return;
    }

    if (selectedSavedAddressId) {
      setIsAddingNewAddress(false);
    }
  }, [hasSavedAddresses, selectedSavedAddressId]);

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

  // Keep checkout identity aligned with auth state while preserving guest-edited fields.
  useEffect(() => {
    if (!isAuthenticated) return;
    reset(
      {
        email: checkoutEmail,
        firstName: checkoutFirstName,
        lastName: checkoutLastName,
        phone: checkoutPhone,
        address: getValues('address'),
        city: getValues('city'),
        state: getValues('state'),
        notes: getValues('notes'),
      },
      { keepDirtyValues: true }
    );
  }, [
    checkoutEmail,
    checkoutFirstName,
    checkoutLastName,
    checkoutPhone,
    getValues,
    isAuthenticated,
    reset,
  ]);

  const currentContactSummary = `${watchedFirstName} ${watchedLastName}`.trim();
  const currentDeliverySummary = [watchedAddress, watchedCity, watchedState]
    .filter(Boolean)
    .join(', ');
  const openNewAddressEditor = () => {
    if (selectedSavedAddressId) {
      setValue('address', '', { shouldValidate: false });
      setValue('city', '', { shouldValidate: false });
      setValue('state', '', { shouldValidate: false });
    }
    setSelectedSavedAddressId(null);
    setIsAddingNewAddress(true);
    setSaveAsDefaultAddress(savedAddresses.length <= 1);
  };

  const renderSavedAddressOptions = () => {
    if (!hasSavedAddresses) return null;

    return (
      <View style={styles.savedAddressSection}>
        <View style={styles.savedAddressHeader}>
          <Text
            style={[styles.savedAddressSectionTitle, { color: colors.text }]}
          >
            Delivery options
          </Text>
          {isLoadingSavedAddresses && (
            <ActivityIndicator size="small" color={BRAND.primary} />
          )}
        </View>
        <View
          style={[
            styles.addressModeSwitch,
            {
              backgroundColor: isDark
                ? 'rgba(255, 255, 255, 0.05)'
                : palette.gray[100],
              borderColor: colors.border,
            },
          ]}
        >
          <Pressable
            style={[
              styles.addressModeChip,
              {
                backgroundColor: !isAddingNewAddress
                  ? BRAND.primary
                  : 'transparent',
              },
            ]}
            onPress={() => {
              const fallbackSavedAddress =
                selectedSavedAddress ??
                defaultSavedAddress ??
                savedAddresses[0];
              if (fallbackSavedAddress) {
                applySavedAddressToForm(fallbackSavedAddress, {
                  collapse: false,
                });
              } else {
                setIsAddingNewAddress(false);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Use a saved address"
          >
            <Ionicons
              name="bookmark-outline"
              size={15}
              color={!isAddingNewAddress ? '#FFFFFF' : BRAND.primary}
            />
            <Text
              style={[
                styles.addressModeChipText,
                { color: !isAddingNewAddress ? '#FFFFFF' : colors.text },
              ]}
            >
              Saved
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.addressModeChip,
              {
                backgroundColor: isAddingNewAddress
                  ? BRAND.primary
                  : 'transparent',
              },
            ]}
            onPress={openNewAddressEditor}
            accessibilityRole="button"
            accessibilityLabel="Add a new delivery address"
          >
            <Ionicons
              name="add-outline"
              size={16}
              color={isAddingNewAddress ? '#FFFFFF' : BRAND.primary}
            />
            <Text
              style={[
                styles.addressModeChipText,
                { color: isAddingNewAddress ? '#FFFFFF' : colors.text },
              ]}
            >
              New address
            </Text>
          </Pressable>
        </View>
        {!isAddingNewAddress &&
          savedAddresses.map((savedAddress) => {
            const isSelected = savedAddress.id === selectedSavedAddressId;

            return (
              <Pressable
                key={savedAddress.id}
                onPress={() =>
                  applySavedAddressToForm(savedAddress, { collapse: false })
                }
                style={[
                  styles.savedAddressOption,
                  {
                    backgroundColor: isSelected
                      ? isDark
                        ? 'rgba(217, 59, 48, 0.12)'
                        : palette.red[50]
                      : colors.background,
                    borderColor: isSelected ? BRAND.primary : colors.border,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Use ${savedAddress.label || 'saved'} address`}
              >
                <View
                  style={[
                    styles.savedAddressIconWrap,
                    {
                      backgroundColor: isSelected
                        ? `${BRAND.primary}18`
                        : isDark
                          ? 'rgba(255,255,255,0.07)'
                          : palette.gray[100],
                    },
                  ]}
                >
                  <Ionicons
                    name={getAddressLabelIcon(savedAddress.label)}
                    size={18}
                    color={isSelected ? BRAND.primary : colors.textSecondary}
                  />
                </View>
                <View style={styles.savedAddressOptionBody}>
                  <View style={styles.savedAddressOptionTitleRow}>
                    <Text
                      style={[
                        styles.savedAddressOptionTitle,
                        { color: colors.text },
                      ]}
                    >
                      {savedAddress.full_name}
                    </Text>
                    {savedAddress.is_default && (
                      <View
                        style={[
                          styles.savedAddressDefaultBadge,
                          { backgroundColor: `${BRAND.primary}14` },
                        ]}
                      >
                        <Text
                          style={[
                            styles.savedAddressDefaultBadgeText,
                            { color: BRAND.primary },
                          ]}
                        >
                          Default
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.savedAddressMeta,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {savedAddress.address}
                  </Text>
                </View>
                <Ionicons
                  name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                  size={20}
                  color={isSelected ? BRAND.primary : colors.textSecondary}
                />
              </Pressable>
            );
          })}
      </View>
    );
  };

  const renderDefaultAddressCheckbox = (label: string) => (
    <View style={styles.saveDetailsSection}>
      <Pressable
        style={styles.checkboxRow}
        onPress={() => setSaveAsDefaultAddress((value) => !value)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: saveAsDefaultAddress }}
        accessibilityLabel={label}
      >
        <View
          style={[
            styles.checkbox,
            saveAsDefaultAddress && styles.checkboxChecked,
            {
              borderColor: saveAsDefaultAddress ? BRAND.primary : colors.border,
            },
          ]}
        >
          {saveAsDefaultAddress && (
            <Ionicons name="checkmark" size={14} color="#FFFFFF" />
          )}
        </View>
        <Text style={[styles.checkboxLabel, { color: colors.text }]}>
          {label}
        </Text>
      </Pressable>
    </View>
  );

  const getAvailableMethodsForTab = (tab: PaymentTab) =>
    availablePaymentMethods.filter(
      (method) => getPaymentTabForMethod(method) === tab
    );

  const handleSelectPaymentTab = (tab: PaymentTab) => {
    setPaymentTab(tab);
    const tabMethods = getAvailableMethodsForTab(tab);
    if (tabMethods.length > 0) {
      setSelectedPayment(tabMethods[0]);
    }
  };

  // Reset payment method if current selection is not in enabled list
  useEffect(() => {
    const currentTabMethods = availablePaymentMethods.filter(
      (method) => getPaymentTabForMethod(method) === paymentTab
    );
    const paymentStillAvailable =
      availablePaymentMethods.includes(selectedPayment);

    if (!paymentStillAvailable) {
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
      } else {
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
    }
  }, [availablePaymentMethods, selectedPayment, paymentTab]);

  const handleBack = () => {
    if (step === 'payment') {
      setStep('address');
    } else if (step === 'review') {
      setStep('payment');
    } else {
      router.back();
    }
  };

  const handleHardwareBackPress = useEffectEvent(() => {
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

    if (step === 'payment') {
      setStep('address');
    } else if (step === 'review') {
      setStep('payment');
    } else {
      router.back();
    }

    return true;
  });

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      handleHardwareBackPress
    );

    return () => backHandler.remove();
  }, []);

  useEffect(() => {
    if (isProcessing) {
      cancelAnimation(ctaArrowTranslateX);
      ctaArrowTranslateX.set(0);
      return;
    }

    ctaArrowTranslateX.set(
      withRepeat(
        withSequence(
          withTiming(6, { duration: 800 }),
          withTiming(0, { duration: 800 })
        ),
        -1,
        true
      )
    );

    return () => {
      cancelAnimation(ctaArrowTranslateX);
      ctaArrowTranslateX.set(0);
    };
  }, [ctaArrowTranslateX, isProcessing]);

  const animatedCtaArrowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: ctaArrowTranslateX.get() }],
  }));

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
      setShippingQuotes([]);
      setSelectedQuoteId('');
      setResolvedShippingQuoteContextKey('');
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

    // Pickup station and airport delivery don't use dynamic shipping quotes
    if (deliveryMethod !== 'door') {
      shippingQuoteAbortRef.current = null;
      setIsLoadingQuotes(false);
      setShippingQuotes([]);
      setSelectedQuoteId('');
      setResolvedShippingQuoteContextKey('');
      return;
    }

    if (watchedState && watchedCity) {
      const controller = new AbortController();
      shippingQuoteAbortRef.current = controller;
      const shouldResetSelection =
        resolvedShippingQuoteContextKey !== currentShippingQuoteContextKey;
      const receiver = shippingQuoteReceiverRef.current;

      fetchShippingQuotes({
        apiUrl: API_BASE_URL,
        state: watchedState,
        city: watchedCity,
        items,
        customer: receiver.customer,
        watchedFirstName: receiver.watchedFirstName,
        watchedLastName: receiver.watchedLastName,
        watchedPhone: receiver.watchedPhone,
        watchedAddress: receiver.watchedAddress,
        watchedEmail: receiver.watchedEmail,
        setIsLoadingQuotes,
        setSelectedQuoteId,
        setResolvedShippingQuoteContextKey,
        setShippingQuotes,
        previousSelectedQuoteId: shouldResetSelection
          ? null
          : selectedQuoteIdRef.current,
        quoteContextKey: currentShippingQuoteContextKey,
        shouldResetSelection,
        signal: controller.signal,
      });
    } else {
      shippingQuoteAbortRef.current = null;
      setShippingQuotes([]);
      setSelectedQuoteId('');
      setResolvedShippingQuoteContextKey('');
    }

    return () => {
      // Cleanup: abort on unmount or before next effect run
      if (shippingQuoteAbortRef.current) {
        shippingQuoteAbortRef.current.abort();
      }
    };
  }, [
    deliveryMethod,
    watchedState,
    watchedCity,
    items,
    currentShippingQuoteContextKey,
    resolvedShippingQuoteContextKey,
  ]);

  const selectedQuote = shippingQuotes.find(
    (quote) => String(quote.id) === String(selectedQuoteId)
  );
  const deliveryFee = getDeliveryMethodFee(deliveryMethod, selectedQuote);

  const handleRetryShippingQuotes = () => {
    if (!watchedState || !watchedCity) return;
    if (shippingQuoteAbortRef.current) {
      shippingQuoteAbortRef.current.abort();
    }
    const controller = new AbortController();
    shippingQuoteAbortRef.current = controller;
    const shouldResetSelection =
      resolvedShippingQuoteContextKey !== currentShippingQuoteContextKey;
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
      setResolvedShippingQuoteContextKey,
      setShippingQuotes,
      previousSelectedQuoteId: shouldResetSelection ? null : selectedQuoteId,
      quoteContextKey: currentShippingQuoteContextKey,
      shouldResetSelection,
      signal: controller.signal,
    });
  };

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

  const handleAddressValidationError = (
    errors: FieldErrors<ShippingAddressInput>
  ) => {
    const hasContactErrors = Boolean(
      errors.firstName || errors.lastName || errors.phone || errors.email
    );
    const hasDeliveryErrors = Boolean(
      errors.address || errors.city || errors.state
    );

    if (hasContactErrors) {
      setIsContactCollapsed(false);
    }

    if (hasDeliveryErrors) {
      setIsDeliveryCollapsed(false);
    }

    const failingFields = (
      Object.keys(errors) as Array<keyof ShippingAddressInput>
    ).filter((field) => Boolean(errors[field]));

    const firstField = failingFields[0];
    const message =
      firstField && errors[firstField]?.message
        ? errors[firstField]?.message
        : firstField
          ? `Please complete your ${humanizeCheckoutFieldName(firstField)} before continuing.`
          : hasDeliveryErrors
            ? 'Please complete your delivery address before continuing.'
            : 'Please complete your contact details before continuing.';

    Alert.alert('Incomplete Details', message, [{ text: 'OK' }]);
  };

  const handleContinue = () => {
    Keyboard.dismiss();

    if (step === 'address') {
      if (deliveryMethod === 'pickup_station') {
        // For pickup station, supply the fixed address to the form for validation
        // without persisting it as the user's door address via setCommittedAddress.
        setValue('address', PICKUP_STATION_ADDRESS_LINES.join(', '), {
          shouldValidate: true,
        });
        setValue('city', PICKUP_STATION_CITY, { shouldValidate: true });
        setValue('state', PICKUP_STATION_STATE, { shouldValidate: true });
        handleSubmit(onAddressSubmit, handleAddressValidationError)();
      } else {
        handleSubmit(onAddressSubmit, handleAddressValidationError)();
      }
    } else if (step === 'payment') {
      if (!selectedPayment) {
        Alert.alert(
          'Select Payment Method',
          'Choose how you want to pay before continuing to review.'
        );
        return;
      }
      trackCheckoutStep('payment_method', {
        payment_method: selectedPayment,
      });
      setStep('review');
    }
  };

  const handleSelectDeliveryMethod = (method: DeliveryMethod) => {
    if (method === 'pickup_station' && deliveryMethod !== 'pickup_station') {
      savedDoorAddressRef.current = {
        address: watchedAddress,
        city: watchedCity,
        state: watchedState,
      };
    } else if (
      method !== 'pickup_station' &&
      deliveryMethod === 'pickup_station'
    ) {
      const saved = savedDoorAddressRef.current;
      if (saved) {
        setValue('address', saved.address, { shouldValidate: false });
        setValue('city', saved.city, { shouldValidate: false });
        setValue('state', saved.state, { shouldValidate: false });
        setCommittedAddress(saved.address);
        savedDoorAddressRef.current = null;
      }
    }
    setDeliveryMethod(method);
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
        [{ text: 'OK', onPress: () => router.replace('/') }]
      );
      return;
    }

    if (isOrderInFlight.current || isProcessing) {
      return;
    }

    if (isLoadingQuotes) {
      Alert.alert(
        'Still Fetching Delivery',
        'Please wait for delivery options to finish loading before placing your order.'
      );
      return;
    }

    // Re-validate that the selected payment method is still enabled
    // (merchant may have toggled it since the user selected it)
    if (
      availablePaymentMethods.length > 0 &&
      !availablePaymentMethods.includes(selectedPayment)
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
    const requiresFreshShippingQuote =
      deliveryMethod === 'door' && Boolean(currentShippingQuoteContextKey);
    const hasFreshShippingQuoteSelection =
      resolvedShippingQuoteContextKey === currentShippingQuoteContextKey &&
      Boolean(selectedQuote);

    if (requiresFreshShippingQuote && !hasFreshShippingQuoteSelection) {
      Alert.alert(
        'Shipping Required',
        'Please confirm a delivery option before placing your order.',
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
      const paymentMethodForOrder =
        selectedPayment === 'payforme' ? 'invoice' : selectedPayment;
      const orderShippingAddress =
        deliveryMethod === 'pickup_station'
          ? {
              ...address,
              address: PICKUP_STATION_ADDRESS_LINES.join(', '),
              city: PICKUP_STATION_CITY,
              state: PICKUP_STATION_STATE,
            }
          : deliveryMethod === 'airport'
            ? {
                ...address,
                address: address.address || 'Airport Delivery (Outside Lagos)',
              }
            : address;

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
          selected_quote_id:
            deliveryMethod === 'door' && selectedQuote?.id != null
              ? String(selectedQuote.id)
              : undefined,
          shipping_provider: getShippingProviderForMethod(
            deliveryMethod,
            selectedQuote
          ),
          payment_method: paymentMethodForOrder,
          shipping_address: orderShippingAddress,
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
        selected_quote_id:
          deliveryMethod === 'door' && selectedQuote?.id != null
            ? String(selectedQuote.id)
            : undefined,
        shipping_provider: getShippingProviderForMethod(
          deliveryMethod,
          selectedQuote
        ),
        payment_method: paymentMethodForOrder,
        shipping_address: orderShippingAddress,
        source: 'mobile_app',
      });

      const { order } = orderResponse;
      const orderNumber =
        order.order_number || order.id.slice(0, 8).toUpperCase();
      const runPostOrderSideEffects = () => {
        void (async () => {
          if (isAuthenticated && customer?.id && saveAsDefaultAddress) {
            try {
              const { data, error } = await supabase
                .from('customers')
                .select('saved_addresses')
                .eq('id', customer.id)
                .eq('merchant_id', MERCHANT_ID)
                .single();

              if (error) throw error;

              const nextSavedAddresses = upsertSavedAddress(
                Array.isArray(data?.saved_addresses)
                  ? (data.saved_addresses as SavedAddress[])
                  : [],
                address,
                {
                  selectedSavedAddressId,
                  setAsDefault: true,
                }
              );

              const { error: updateError } = await supabase
                .from('customers')
                .update({ saved_addresses: nextSavedAddresses })
                .eq('id', customer.id)
                .eq('merchant_id', MERCHANT_ID);

              if (updateError) throw updateError;
            } catch (error) {
              trackError(
                'checkout_save_default_address',
                error instanceof Error
                  ? error.message
                  : 'Failed to save default address'
              );
            }
          }

          await scheduleLocalNotification(
            'Order Received! 📦',
            `Your order #${orderNumber} is being processed. We'll notify you when it ships.`,
            { type: 'order_update', orderNumber, orderId: order.id },
            1
          );

          if (!isAuthenticated && saveDetails && accountPassword.length >= 6) {
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
        })();
      };

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
        runPostOrderSideEffects();
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
        runPostOrderSideEffects();
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
          paymentMethod: selectedPayment,
          ...(order.tracking_token && {
            trackingToken: order.tracking_token,
          }),
        },
      });
      runPostOrderSideEffects();
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
  const handlePlaceOrder = handleSubmit(onCheckoutSubmit, (_errors) => {
    Alert.alert(
      'Incomplete Details',
      'Please fill in all required fields (Address, City, Phone) to place your order.',
      [{ text: 'OK' }]
    );
  });

  const renderAddressForm = () => (
    <ScrollView
      ref={addressScrollRef}
      style={styles.formContainer}
      contentContainerStyle={[
        styles.formContent,
        { paddingBottom: formContentPaddingBottom },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      onScroll={(e) => {
        addressScrollOffsetRef.current = e.nativeEvent.contentOffset.y;
      }}
      scrollEventThrottle={16}
    >
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Delivery Address
        </Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          {isAuthenticated
            ? 'Choose how this order should be delivered.'
            : 'Add your contact and delivery details to continue.'}
        </Text>
      </View>

      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
            overflow: 'visible',
            zIndex: 20,
            position: 'relative',
          },
        ]}
      >
        <View style={styles.cardHeaderActionRow}>
          <View style={[styles.cardHeader, styles.cardHeaderInline]}>
            <Ionicons name="person-outline" size={16} color={BRAND.primary} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Contact
            </Text>
          </View>
          {isAuthenticated && (isContactCollapsed || hasContactIdentity) && (
            <Pressable
              style={styles.inlineEditButton}
              onPress={() => setIsContactCollapsed((value) => !value)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={
                isContactCollapsed
                  ? 'Edit contact details'
                  : 'Collapse contact details'
              }
            >
              <View style={styles.inlineActionContent}>
                <Ionicons
                  name={
                    isContactCollapsed ? 'create-outline' : 'checkmark-outline'
                  }
                  size={16}
                  color={BRAND.primary}
                />
                <Text style={styles.inlineActionText}>
                  {isContactCollapsed ? 'Edit' : 'Done'}
                </Text>
              </View>
            </Pressable>
          )}
        </View>
        {isContactCollapsed ? (
          <View
            style={[
              styles.summaryPanel,
              {
                backgroundColor: isDark
                  ? 'rgba(255, 255, 255, 0.04)'
                  : palette.gray[50],
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.summaryMetaRow}>
              <Ionicons
                name="person-circle-outline"
                size={16}
                color={BRAND.primary}
              />
              <Text
                style={[
                  styles.summaryMetaLabel,
                  { color: colors.textSecondary },
                ]}
              >
                Signed in
              </Text>
            </View>
            <Text style={[styles.summaryTitle, { color: colors.text }]}>
              {currentContactSummary || 'Contact details'}
            </Text>
            {watchedEmail ? (
              <Text
                style={[styles.summaryLine, { color: colors.textSecondary }]}
              >
                {watchedEmail}
              </Text>
            ) : null}
            {watchedPhone ? (
              <Text
                style={[styles.summaryLine, { color: colors.textSecondary }]}
              >
                {watchedPhone}
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={[styles.cardBody, styles.contactCardBody]}>
            <View style={styles.row}>
              <View style={styles.halfInput}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  First Name
                </Text>
                <FormField
                  name="firstName"
                  label=""
                  placeholder="E.g. John"
                  control={control}
                  errors={errors}
                  colors={colors}
                  autoCapitalize="words"
                />
              </View>
              <View style={styles.halfInput}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  Last Name
                </Text>
                <FormField
                  name="lastName"
                  label=""
                  placeholder="E.g. Doe"
                  control={control}
                  errors={errors}
                  colors={colors}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <Text
              style={[
                styles.label,
                { color: colors.textSecondary, marginBottom: 8 },
              ]}
            >
              Phone Number
            </Text>
            <Controller
              control={control}
              name="phone"
              render={({ field: { value, onChange, onBlur } }) => (
                <PhoneInput
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.phone?.message}
                  containerStyle={styles.compactInputGroup}
                />
              )}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Email Address
            </Text>
            <FormField
              name="email"
              label=""
              placeholder="john@example.com"
              control={control}
              errors={errors}
              colors={colors}
              containerStyle={styles.compactInputGroup}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            {/* Save Details Checkbox — guests only */}
            {!isAuthenticated && (
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
                        borderColor: saveDetails
                          ? BRAND.primary
                          : colors.border,
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
        )}
      </View>

      <DeliveryMethodCard
        colors={colors}
        isDark={isDark}
        selectedMethod={deliveryMethod}
        onSelectMethod={handleSelectDeliveryMethod}
        doorSubtitle={
          selectedQuote != null
            ? getDeliveryMethodSummary('door', selectedQuote)
            : 'Rates loaded after you enter your address'
        }
        doorPrice={
          selectedQuote != null ? formatPrice(selectedQuote.price) : '—'
        }
        airportFee={AIRPORT_DELIVERY_FEE}
      />

      {deliveryMethod !== 'pickup_station' && (
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
              zIndex: 10,
              position: 'relative',
            },
          ]}
        >
          <View style={styles.cardHeaderActionRow}>
            <View style={[styles.cardHeader, styles.cardHeaderInline]}>
              <Ionicons
                name="location-outline"
                size={16}
                color={BRAND.primary}
              />
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                Delivery
              </Text>
            </View>
            {(hasSavedAddresses || Boolean(currentDeliverySummary)) && (
              <Pressable
                style={styles.inlineEditButton}
                onPress={() => setIsDeliveryCollapsed((value) => !value)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={
                  isDeliveryCollapsed
                    ? 'Edit delivery address'
                    : 'Collapse delivery address'
                }
              >
                <View style={styles.inlineActionContent}>
                  <Ionicons
                    name={
                      isDeliveryCollapsed
                        ? 'create-outline'
                        : 'checkmark-outline'
                    }
                    size={16}
                    color={BRAND.primary}
                  />
                  <Text style={styles.inlineActionText}>
                    {isDeliveryCollapsed ? 'Edit' : 'Done'}
                  </Text>
                </View>
              </Pressable>
            )}
          </View>
          {isDeliveryCollapsed ? (
            <View
              style={[
                styles.summaryPanel,
                {
                  backgroundColor: isDark
                    ? 'rgba(255, 255, 255, 0.04)'
                    : palette.gray[50],
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.summaryMetaRow}>
                <Ionicons
                  name="navigate-circle-outline"
                  size={16}
                  color={BRAND.primary}
                />
                <Text
                  style={[
                    styles.summaryMetaLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  {selectedSavedAddress?.is_default
                    ? 'Default address'
                    : 'Delivery destination'}
                </Text>
              </View>
              <View style={styles.summaryTitleRow}>
                <Text style={[styles.summaryTitle, { color: colors.text }]}>
                  {selectedSavedAddress?.label || 'Delivery address'}
                </Text>
                {selectedSavedAddress?.is_default && (
                  <View
                    style={[
                      styles.savedAddressDefaultBadge,
                      { backgroundColor: `${BRAND.primary}14` },
                    ]}
                  >
                    <Text
                      style={[
                        styles.savedAddressDefaultBadgeText,
                        { color: BRAND.primary },
                      ]}
                    >
                      Default
                    </Text>
                  </View>
                )}
              </View>
              <Text
                style={[styles.summaryLine, { color: colors.textSecondary }]}
              >
                {currentDeliverySummary || 'No delivery address selected yet'}
              </Text>
            </View>
          ) : (
            <View
              style={[styles.cardBody, { overflow: 'visible', zIndex: 50 }]}
            >
              {renderSavedAddressOptions()}
              {hasSavedAddresses && !isAddingNewAddress ? (
                isAuthenticated &&
                renderDefaultAddressCheckbox(
                  selectedSavedAddress?.is_default
                    ? 'Keep as default address'
                    : 'Make selected address my default'
                )
              ) : (
                <>
                  {hasSavedAddresses && (
                    <View
                      style={[
                        styles.newAddressIntro,
                        {
                          backgroundColor: isDark
                            ? 'rgba(255, 255, 255, 0.04)'
                            : palette.gray[50],
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Ionicons
                        name="sparkles-outline"
                        size={18}
                        color={BRAND.primary}
                      />
                      <View style={styles.newAddressIntroBody}>
                        <Text
                          style={[
                            styles.newAddressIntroTitle,
                            { color: colors.text },
                          ]}
                        >
                          New delivery address
                        </Text>
                        <Text
                          style={[
                            styles.newAddressIntroText,
                            { color: colors.textSecondary },
                          ]}
                        >
                          Use this if this order should go somewhere else.
                        </Text>
                      </View>
                    </View>
                  )}
                  <Controller
                    control={control}
                    name="address"
                    render={({ field: { value, onChange } }) => (
                      <AddressAutocomplete
                        value={value}
                        onChangeText={(text) => {
                          onChange(text);
                          // If the user edits after committing via autocomplete, invalidate
                          // the resolved context key so the next state/city change forces a
                          // fresh fetch against the new typed address.
                          if (committedAddress) {
                            setResolvedShippingQuoteContextKey('');
                          }
                          setCommittedAddress('');
                        }}
                        scrollRef={addressScrollRef}
                        scrollOffsetRef={addressScrollOffsetRef}
                        onSelect={(place) => {
                          const selectedAddress = place.formattedAddress || '';
                          onChange(selectedAddress);
                          setCommittedAddress(selectedAddress);
                          const normalizedState = place.state
                            ? normalizeStateName(place.state, shippingStates)
                            : '';
                          if (place.city) {
                            const normalizedCity = place.city
                              .trim()
                              .toLowerCase();
                            if (
                              normalizedState &&
                              normalizedCity === normalizedState.toLowerCase()
                            ) {
                              googleSuggestedCityRef.current = '';
                            } else {
                              googleSuggestedCityRef.current = place.city;
                            }
                          }
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
                      <Text
                        style={[styles.label, { color: colors.textSecondary }]}
                      >
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
                                  backgroundColor: isDark
                                    ? 'rgba(255, 255, 255, 0.05)'
                                    : '#F9FAFB',
                                  borderColor: errors.city
                                    ? '#EF4444'
                                    : 'transparent',
                                },
                              ]}
                              accessibilityRole="button"
                              accessibilityLabel="Select city"
                            >
                              <Text
                                style={[
                                  styles.selectInputText,
                                  {
                                    color: value
                                      ? colors.text
                                      : colors.textSecondary,
                                  },
                                ]}
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
                      <Text
                        style={[styles.label, { color: colors.textSecondary }]}
                      >
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
                                  backgroundColor: isDark
                                    ? 'rgba(255, 255, 255, 0.05)'
                                    : '#F9FAFB',
                                  borderColor: errors.state
                                    ? '#EF4444'
                                    : 'transparent',
                                },
                              ]}
                              accessibilityRole="button"
                              accessibilityLabel="Select state"
                            >
                              <Text
                                style={[
                                  styles.selectInputText,
                                  {
                                    color: value
                                      ? colors.text
                                      : colors.textSecondary,
                                  },
                                ]}
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
                  {isAuthenticated &&
                    renderDefaultAddressCheckbox('Set as default address')}
                </>
              )}
            </View>
          )}
        </View>
      )}

      {deliveryMethod === 'pickup_station' && (
        <PickupStationCard colors={colors} isDark={isDark} />
      )}

      {deliveryMethod === 'door' && watchedState && watchedCity && (
        <ShippingQuotesCard
          colors={colors}
          isDark={isDark}
          isLoadingQuotes={isLoadingQuotes}
          shippingQuotes={shippingQuotes}
          selectedQuoteId={selectedQuoteId}
          onSelectQuote={setSelectedQuoteId}
          onRetryQuotes={handleRetryShippingQuotes}
        />
      )}

      <DeliveryNotesCard colors={colors} isDark={isDark}>
        <FormField
          name="notes"
          label=""
          placeholder="Any special instructions for delivery"
          multiline
          control={control}
          errors={errors}
          colors={colors}
        />
      </DeliveryNotesCard>
    </ScrollView>
  );

  const renderPaymentOptions = () => (
    <ScrollView
      style={styles.formContainer}
      contentContainerStyle={[
        styles.formContent,
        { paddingBottom: formContentPaddingBottom },
      ]}
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
        onSelectTab={handleSelectPaymentTab}
        orderTotal={total}
        enabledMethods={availablePaymentMethods}
      />
    </ScrollView>
  );

  const renderReview = () => {
    const address = getValues();

    return (
      <ScrollView
        style={styles.formContainer}
        contentContainerStyle={[
          styles.formContent,
          { paddingBottom: formContentPaddingBottom },
        ]}
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
            {
              backgroundColor: colors.card,
              borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
              ...SHADOWS.sm,
            },
          ]}
        >
          <View style={styles.reviewHeader}>
            <Text style={[styles.reviewTitle, { color: colors.text }]}>
              Delivery Method
            </Text>
            <Pressable onPress={() => setStep('address')}>
              <Text style={[styles.editLink, { color: BRAND.primary }]}>
                Edit
              </Text>
            </Pressable>
          </View>
          <Text style={[styles.reviewTextStrong, { color: colors.text }]}>
            {getDeliveryMethodLabel(deliveryMethod)}
          </Text>
          {selectedQuote && deliveryMethod === 'door' && (
            <Text style={[styles.reviewText, { color: colors.textSecondary }]}>
              {selectedQuote.displayName}
              {selectedQuote.deliveryRange || selectedQuote.estimatedDays
                ? ` • ${selectedQuote.deliveryRange ?? `${selectedQuote.estimatedDays} days`}`
                : null}
            </Text>
          )}
          {deliveryMethod === 'airport' && (
            <Text style={[styles.reviewText, { color: colors.textSecondary }]}>
              Est. 24–48 working hours
            </Text>
          )}
        </View>

        <View
          style={[
            styles.reviewCard,
            {
              backgroundColor: colors.card,
              borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
              ...SHADOWS.sm,
            },
          ]}
        >
          <View style={styles.reviewHeader}>
            <Text style={[styles.reviewTitle, { color: colors.text }]}>
              Delivery Address
            </Text>
          </View>
          <Text style={[styles.reviewText, { color: colors.text }]}>
            {address.firstName} {address.lastName}
          </Text>
          <Text style={[styles.reviewText, { color: colors.textSecondary }]}>
            {address.phone}
          </Text>
          <Text style={[styles.reviewText, { color: colors.textSecondary }]}>
            {deliveryMethod === 'pickup_station'
              ? PICKUP_STATION_ADDRESS_LINES.join('\n')
              : deliveryMethod === 'airport'
                ? `${address.city}, ${address.state}`
                : address.address}
          </Text>
        </View>

        <View
          style={[
            styles.reviewCard,
            {
              backgroundColor: colors.card,
              borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
              ...SHADOWS.sm,
            },
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
            {
              backgroundColor: colors.card,
              borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
              ...SHADOWS.sm,
            },
          ]}
        >
          <Text style={[styles.reviewTitle, { color: colors.text }]}>
            Order Items ({items.length})
          </Text>
          {items.map((item) => (
            <View key={item.id} style={styles.orderItem}>
              <Text style={[styles.orderItemName, { color: colors.text }]}>
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
            {
              backgroundColor: colors.card,
              borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
              ...SHADOWS.sm,
            },
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
          headerShown: false,
        }}
      />

      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['top', 'left', 'right']}
      >
        <View
          style={[
            styles.screenHeader,
            {
              backgroundColor: colors.background,
              borderBottomColor: colors.border,
              paddingTop: 0,
              paddingBottom: SPACING.sm,
            },
          ]}
        >
          <Pressable
            onPress={handleBack}
            style={styles.backBtn}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.screenHeaderTitle, { color: colors.text }]}>
            Checkout
          </Text>
          <View style={styles.screenHeaderSpacer} />
        </View>

        <KeyboardAvoidingView
          style={[styles.contentShell, { backgroundColor: colors.muted }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <CheckoutStepper
            step={step}
            setStep={setStep}
            itemCount={items.reduce((acc, item) => acc + item.quantity, 0)}
            colors={colors}
            isDark={isDark}
          />

          {step === 'address' && renderAddressForm()}
          {step === 'payment' && renderPaymentOptions()}
          {step === 'review' && renderReview()}

          <View
            style={[
              styles.bottomAction,
              {
                backgroundColor: colors.card,
                borderTopColor: colors.border,
                paddingBottom: insets.bottom,
              },
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
                  accessibilityLabel={`${selectedPayment === 'invoice' ? 'Generate invoice' : selectedPayment === 'payforme' ? 'Prepare pay for me order' : 'Place order'} for ${formatPrice(total)}`}
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
                      <Text style={styles.actionButtonText}>
                        {selectedPayment === 'invoice'
                          ? 'Generate Invoice'
                          : selectedPayment === 'payforme'
                            ? 'Pay for Me'
                            : 'Place Order'}
                      </Text>
                      <Animated.View style={animatedCtaArrowStyle}>
                        <Ionicons
                          name="arrow-forward"
                          size={18}
                          color="#FFFFFF"
                        />
                      </Animated.View>
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
                  <Animated.View style={animatedCtaArrowStyle}>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                  </Animated.View>
                </Pressable>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* State Picker */}
      <Modal
        visible={showStatePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStatePicker(false)}
      >
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerSheet, { backgroundColor: colors.card }]}>
            <View style={styles.pickerHeader}>
              <Text style={[styles.pickerTitle, { color: colors.text }]}>
                Select State
              </Text>
              <Pressable onPress={() => setShowStatePicker(false)} hitSlop={12}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>
            <FlatList
              data={shippingStates}
              keyExtractor={(item) => item}
              // ⚡ Bolt Performance Optimization
              // Applying standard windowing props to optimize Modal render cycles and prevent UI thread blocking
              // initialNumToRender: Keeps initial mount fast by limiting items rendered on first pass
              // maxToRenderPerBatch: Prevents dropping frames when rendering subsequent items
              // windowSize: Reduces memory footprint by keeping only a small buffer of items outside the viewport
              // removeClippedSubviews: Frees memory for off-screen views (Android only due to iOS clipping bugs)
              initialNumToRender={15}
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews={Platform.OS === 'android'}
              renderItem={({ item }) => (
                <Pressable
                  style={[
                    styles.pickerItem,
                    { borderBottomColor: colors.border },
                    item === watchedState && {
                      backgroundColor: isDark
                        ? 'rgba(217, 59, 48, 0.14)'
                        : palette.red[50],
                    },
                  ]}
                  onPress={() => handleSelectState(item)}
                >
                  <View style={styles.pickerItemContent}>
                    <Text
                      style={[
                        styles.pickerItemText,
                        {
                          color:
                            item === watchedState
                              ? isDark
                                ? '#FDECEA'
                                : BRAND.primary
                              : colors.text,
                          fontWeight: item === watchedState ? '700' : '500',
                        },
                      ]}
                    >
                      {item}
                    </Text>
                    {item === watchedState && (
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color={BRAND.primary}
                      />
                    )}
                  </View>
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.pickerOverlay}
        >
          <View style={[styles.pickerSheet, { backgroundColor: colors.card }]}>
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
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>
            <View
              style={[
                styles.citySearchContainer,
                {
                  backgroundColor: isDark
                    ? 'rgba(255, 255, 255, 0.05)'
                    : '#F9FAFB',
                  borderColor: citySearchFocused
                    ? BRAND.primary
                    : 'transparent',
                },
              ]}
            >
              <Ionicons
                name="search"
                size={16}
                color={citySearchFocused ? BRAND.primary : colors.textSecondary}
              />
              <TextInput
                style={[styles.citySearchInput, { color: colors.text }]}
                placeholder="Search or type your city..."
                placeholderTextColor={colors.textSecondary}
                value={citySearch}
                onChangeText={setCitySearch}
                onFocus={() => setCitySearchFocused(true)}
                onBlur={() => setCitySearchFocused(false)}
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
              // ⚡ Bolt Performance Optimization
              // Applying standard windowing props to optimize Modal render cycles and prevent UI thread blocking
              // initialNumToRender: Keeps initial mount fast by limiting items rendered on first pass
              // maxToRenderPerBatch: Prevents dropping frames when rendering subsequent items
              // windowSize: Reduces memory footprint by keeping only a small buffer of items outside the viewport
              // removeClippedSubviews: Frees memory for off-screen views (Android only due to iOS clipping bugs)
              initialNumToRender={15}
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews={Platform.OS === 'android'}
              renderItem={({ item }) => (
                <Pressable
                  style={[
                    styles.pickerItem,
                    { borderBottomColor: colors.border },
                    item === watchedCity && {
                      backgroundColor: isDark
                        ? 'rgba(217, 59, 48, 0.14)'
                        : palette.red[50],
                    },
                  ]}
                  onPress={() => handleSelectCity(item)}
                >
                  <View style={styles.pickerItemContent}>
                    <Text
                      style={[
                        styles.pickerItemText,
                        {
                          color:
                            item === watchedCity
                              ? isDark
                                ? '#FDECEA'
                                : BRAND.primary
                              : colors.text,
                          fontWeight: item === watchedCity ? '700' : '500',
                        },
                      ]}
                    >
                      {item}
                    </Text>
                    {item === watchedCity && (
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color={BRAND.primary}
                      />
                    )}
                  </View>
                </Pressable>
              )}
              ListHeaderComponent={null}
              ListEmptyComponent={
                !citySearch.trim() ? (
                  <Text
                    style={[styles.helperText, { color: colors.textSecondary }]}
                  >
                    No cities available. Type your city above.
                  </Text>
                ) : null
              }
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
  contentShell: {
    flex: 1,
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  screenHeaderTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  screenHeaderSpacer: {
    width: 40,
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: SPACING.md,
  },
  formContent: {
    paddingBottom: 116,
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
    paddingHorizontal: SPACING.md,
    paddingTop: 14,
    paddingBottom: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    ...SHADOWS.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: SPACING.md,
  },
  cardHeaderInline: {
    marginBottom: 0,
  },
  cardHeaderActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  inlineEditButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  inlineActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: BRAND.primary,
  },
  cardBody: {
    gap: SPACING.sm,
  },
  contactCardBody: {
    gap: 10,
  },
  summarySection: {
    gap: 8,
  },
  summaryPanel: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 8,
  },
  summaryMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryMetaLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  summaryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  summaryLine: {
    fontSize: 14,
    lineHeight: 20,
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
  compactInputGroup: {
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    borderColor: 'transparent',
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
  selectInputText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    marginRight: 8,
  },
  helperText: {
    fontSize: 12,
  },
  savedAddressSection: {
    marginBottom: SPACING.sm,
    gap: 10,
  },
  savedAddressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  savedAddressSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  addressModeSwitch: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  addressModeChip: {
    flex: 1,
    minHeight: 38,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addressModeChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  savedAddressOption: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  savedAddressIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  savedAddressOptionBody: {
    flex: 1,
    gap: 4,
  },
  savedAddressOptionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  savedAddressOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  savedAddressMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  savedAddressDefaultBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  savedAddressDefaultBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  deliveryMethodList: {
    gap: 10,
  },
  deliveryMethodCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 12,
  },
  deliveryMethodTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  deliveryMethodLabelWrap: {
    flex: 1,
    gap: 4,
  },
  deliveryMethodTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  deliveryMethodSubtitle: {
    fontSize: 12,
    lineHeight: 18,
  },
  deliveryMethodMeta: {
    alignItems: 'flex-end',
    gap: 8,
  },
  deliveryMethodPrice: {
    fontSize: 13,
    fontWeight: '700',
  },
  deliveryMethodExpanded: {
    gap: 10,
  },
  deliveryStaticInfo: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  deliveryStaticTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  deliveryStaticText: {
    fontSize: 13,
    lineHeight: 20,
  },
  newAddressIntro: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  newAddressIntroBody: {
    flex: 1,
    gap: 2,
  },
  newAddressIntroTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  newAddressIntroText: {
    fontSize: 12,
    lineHeight: 18,
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
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: SPACING.md,
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
  reviewTextStrong: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
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
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'transparent',
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
    zIndex: 80,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
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
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    borderRadius: 12,
    justifyContent: 'center',
  },
  pickerItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
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
