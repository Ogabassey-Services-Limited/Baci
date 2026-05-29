import Ionicons from "@react-native-vector-icons/ionicons";
import { zodResolver } from "@hookform/resolvers/zod";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { router, Stack } from "expo-router";
import React, { useEffect, useEffectEvent, useRef } from "react";
import { type FieldErrors, type Resolver, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { CheckoutContactCard } from "@/components/checkout/CheckoutContactCard";
import { CheckoutDeliveryCard } from "@/components/checkout/CheckoutDeliveryCard";
import { CheckoutFormField } from "@/components/checkout/CheckoutFormField";
import {
  type CheckoutStep,
  CheckoutStepper,
} from "@/components/checkout/CheckoutStepper";
import { CheckoutSavingsRetryCard } from "@/components/checkout/CheckoutSavingsRetryCard";
import { CheckoutReviewStep } from "@/components/checkout/CheckoutReviewStep";
import { CryptoSelectionModal } from "@/components/checkout/CryptoSelectionModal";
import { humanizeCheckoutFieldName } from "@/components/checkout/checkout-form-field.helpers";
import {
  fetchShippingQuotes,
  normalizeStateName,
  type ShippingLocation,
} from "@/components/checkout/checkout-shipping.helpers";
import {
  AIRPORT_DELIVERY_FEE,
  getDeliveryMethodFee,
  getDeliveryMethodSummary,
  getPaymentTabForMethod,
  getShippingProviderForMethod,
} from "@/components/checkout/checkout-step-helpers";
import { DeliveryMethodCard } from "@/components/checkout/DeliveryMethodCard";
import { DeliveryNotesCard } from "@/components/checkout/DeliveryNotesCard";
import {
  PaymentMethodSelector,
  type PaymentMethodType,
  type PaymentTab,
} from "@/components/checkout/PaymentMethodSelector";
import {
  PICKUP_STATION_ADDRESS_LINES,
  PICKUP_STATION_CITY,
  PICKUP_STATION_STATE,
  PickupStationCard,
} from "@/components/checkout/PickupStationCard";
import { ShippingQuotesCard } from "@/components/checkout/ShippingQuotesCard";
import type {
  DeliveryMethod,
  ShippingQuote,
} from "@/components/checkout/types";
import type { PlaceDetails } from "@/components/ui/AddressAutocomplete";
import AppKeyboardContainer from "@/components/ui/AppKeyboardContainer";
import { useColorScheme } from "@/components/useColorScheme";
import Colors, {
  BRAND,
  palette,
  RADIUS,
  SHADOWS,
  SPACING,
} from "@/constants/Colors";
import { useAuthStatus } from "@/hooks/use-auth-guard";
import { useCheckoutSavings } from "@/hooks/use-checkout-savings";
import { useWallet } from "@/hooks/use-wallet";
import {
  getEnabledPaymentMethods,
  getMerchantTaxRate,
  useMerchantPaymentSettings,
} from "@/hooks/useMerchantPaymentSettings";
import { resolveApiBaseUrl } from "@/lib/api-url";
import { deriveCheckoutIdentity } from "@/lib/checkout-identity";
import {
  getDefaultSavedAddress,
  type SavedAddress,
  toCheckoutAddressValues,
  upsertSavedAddress,
} from "@/lib/checkout-saved-address";
import { setClipboardString } from "@/lib/clipboard";
import { createWalletFundedBankTransferIntent } from "@/lib/checkout/wallet-funded-bank-transfer";
import {
  buildKlumpBnplRouteParams,
  buildKlumpInitializePayload,
  getKlumpDisabledReason,
} from "@/lib/klump-checkout";
import { buildShippingQuoteContextKey } from "@/lib/shipping-quotes";
import { isStoreCreditCompatiblePayment } from "@/lib/store-credit-compatible-payment";
import type { WalletOrderFundingIntentCreateResponse } from "@/lib/order-wallet-funding-intent";
import { calculateCommerce, supabase } from "@/lib/supabase";
import {
  type ShippingAddressInput,
  ShippingAddressSchema,
} from "@/lib/validation";
import {
  buildSavingsOrderFields,
  buildWalletOrderFields,
  getFullyPaidStoreCreditPaymentMethod,
  type WalletSelection,
} from "@/lib/wallet-payment-helpers";
import {
  trackCheckoutStep,
  trackError,
} from "@/services/analytics";
import { createOrder, OrderError, type OrderResponse } from "@/services/orders";
import { scheduleLocalNotification } from "@/services/push-notifications";
import {
  trackCheckoutRoutePaymentInfo,
  trackCheckoutRoutePurchaseCompleted,
  trackCheckoutRouteStarted,
} from "@/services/tiktok-checkout-route-tracking";
import { formatPrice, useCartStore } from "@/stores/cart-store";

const shippingAddressResolver = zodResolver(
  ShippingAddressSchema as unknown as Parameters<typeof zodResolver>[0],
) as unknown as Resolver<ShippingAddressInput>;

const DEFAULT_ASSURANCE_RATE = 0.05;

interface PendingCryptoOrder {
  order: OrderResponse["order"];
  orderResponse: OrderResponse;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  trackingToken?: string;
}

const API_BASE_URL = resolveApiBaseUrl(
  process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl,
);

const MERCHANT_ID =
  Constants.expoConfig?.extra?.merchantId ||
  "6b5cb8a4-5575-456c-b936-8cdfae30db74";

const MERCHANT_SLUG = Constants.expoConfig?.extra?.merchantSlug || "ogabassey";

function requestWalletFundingAccountConsent() {
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const settle = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    Alert.alert(
      "Create wallet account number?",
      "To use bank transfer to wallet, Paystack needs your consent to create a reusable virtual account number for your wallet.",
      [
        {
          text: "Use one-time transfer",
          style: "cancel",
          onPress: () => settle(false),
        },
        {
          text: "Create account number",
          onPress: () => settle(true),
        },
      ],
      {
        cancelable: true,
        onDismiss: () => settle(false),
      },
    );
  });
}

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

export default function CheckoutScreen() {
  const ctaArrowTranslateX = useSharedValue(0);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const isDark = (colorScheme ?? "light") === "dark";
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
  const walletOrderAutoDebitEnabled = Boolean(
    paymentSettings?.paystack_enabled &&
    paymentSettings.wallet_paystack_dva_enabled &&
    paymentSettings.wallet_order_auto_debit_enabled,
  );
  const availablePaymentMethods: PaymentMethodType[] = Array.from(
    new Set<PaymentMethodType>([
      ...enabledPaymentMethods,
      "invoice",
      "payforme",
    ]),
  );

  const [step, setStep] = React.useState<CheckoutStep>("address");
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [orderTotals, setOrderTotals] = React.useState<{
    total: number;
    taxAmount: number;
  } | null>(null);
  const [selectedPayment, setSelectedPayment] =
    React.useState<PaymentMethodType>("paystack");
  const [paymentTab, setPaymentTab] = React.useState<PaymentTab>("full");
  // Wallet payment selection — independent from `selectedPayment`. The
  // wallet can stack on top of any gateway method (partial deductible) or
  // cover the order in full. The selection is fed into createOrder via
  // `buildWalletOrderFields` and consumed by `<PaymentMethodSelector>`'s
  // wallet row.
  const [walletSelection, setWalletSelection] = React.useState<
    WalletSelection | undefined
  >(undefined);
  const {
    checkoutSavingsBalance,
    checkoutSavingsError,
    checkoutSavingsGoal,
    getLiveSavingsSelection,
    isLoadingCheckoutSavings,
    reloadCheckoutSavings,
    savingsSelection,
    setSavingsSelection,
  } = useCheckoutSavings({
    customerId: customer?.id,
    isAuthenticated,
    items,
    merchantId: MERCHANT_ID,
    merchantSlug: MERCHANT_SLUG,
  });
  const walletQuery = useWallet();
  const walletBalance = walletQuery.data?.wallet?.balance ?? 0;
  const [deliveryMethod, setDeliveryMethod] =
    React.useState<DeliveryMethod>("door");
  const savedDoorAddressRef = React.useRef<{
    address: string;
    city: string;
    state: string;
  } | null>(null);

  const [shippingStates, setShippingStates] = React.useState<string[]>([]);
  const [shippingCities, setShippingCities] = React.useState<string[]>([]);
  const [shippingQuotes, setShippingQuotes] = React.useState<ShippingQuote[]>(
    [],
  );
  const [selectedQuoteId, setSelectedQuoteId] = React.useState<string>("");
  const [resolvedShippingQuoteContextKey, setResolvedShippingQuoteContextKey] =
    React.useState("");
  const [isLoadingLocations, setIsLoadingLocations] = React.useState(false);
  const [isLoadingCities, setIsLoadingCities] = React.useState(false);
  const [isLoadingQuotes, setIsLoadingQuotes] = React.useState(false);
  const [showStatePicker, setShowStatePicker] = React.useState(false);
  const [showCityPicker, setShowCityPicker] = React.useState(false);
  const [citySearch, setCitySearch] = React.useState("");
  const [citySearchFocused, setCitySearchFocused] = React.useState(false);
  const [saveDetails, setSaveDetails] = React.useState(false);
  const [saveAsDefaultAddress, setSaveAsDefaultAddress] = React.useState(false);
  const [savedAddresses, setSavedAddresses] = React.useState<SavedAddress[]>(
    [],
  );
  const [selectedSavedAddressId, setSelectedSavedAddressId] = React.useState<
    string | null
  >(null);
  const [isAddingNewAddress, setIsAddingNewAddress] = React.useState(false);
  const [isLoadingSavedAddresses, setIsLoadingSavedAddresses] =
    React.useState(false);
  const [isContactCollapsed, setIsContactCollapsed] = React.useState(false);
  const [isDeliveryCollapsed, setIsDeliveryCollapsed] = React.useState(false);
  const [accountPassword, setAccountPassword] = React.useState("");

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
      address: "",
      city: "",
      state: "",
      notes: "",
    },
    mode: "onBlur",
  });

  const watchedState = watch("state");
  const watchedCity = watch("city");
  const watchedAddress = watch("address");
  const watchedPhone = watch("phone");
  const watchedFirstName = watch("firstName");
  const watchedLastName = watch("lastName");
  const watchedEmail = watch("email");

  // committedAddress is set when the user picks an autocomplete suggestion or
  // loads a saved address. Only committed addresses drive re-fetches — using
  // watchedAddress here would trigger a new API call on every keystroke.
  const [committedAddress, setCommittedAddress] = React.useState("");
  const effectiveAddress = committedAddress;
  const currentShippingQuoteContextKey = buildShippingQuoteContextKey(
    watchedState,
    watchedCity,
    items,
    effectiveAddress,
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
    checkoutEmail && checkoutFirstName && checkoutLastName && checkoutPhone,
  );
  const initialHasContactIdentityRef = useRef(hasContactIdentity);
  const formContentPaddingBottom = 116 + insets.bottom;
  const selectedSavedAddress =
    savedAddresses.find((item) => item.id === selectedSavedAddressId) ?? null;
  const defaultSavedAddress = getDefaultSavedAddress(savedAddresses);

  const applySavedAddressToForm = (
    savedAddress: SavedAddress,
    options?: { collapse?: boolean },
  ) => {
    const checkoutValues = toCheckoutAddressValues(savedAddress);

    setValue("firstName", checkoutValues.firstName, { shouldValidate: true });
    setValue("lastName", checkoutValues.lastName, { shouldValidate: true });
    setValue("phone", checkoutValues.phone, { shouldValidate: true });
    setValue("address", checkoutValues.address, { shouldValidate: true });
    setValue("city", checkoutValues.city, { shouldValidate: true });
    setValue("state", checkoutValues.state, { shouldValidate: true });
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
            .from("customers")
            .select("saved_addresses")
            .eq("id", customer.id)
            .eq("merchant_id", MERCHANT_ID)
            .single();

          if (error) throw error;

          const addresses = Array.isArray(data?.saved_addresses)
            ? ([...data.saved_addresses] as SavedAddress[])
            : [];

          addresses.sort(
            (left, right) =>
              Number(Boolean(right.is_default)) -
              Number(Boolean(left.is_default)),
          );
          return addresses;
        } catch (error) {
          trackError(
            "checkout_saved_addresses_fetch",
            error instanceof Error
              ? error.message
              : "Failed to load saved addresses",
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
      setValue("firstName", checkoutValues.firstName, { shouldValidate: true });
      setValue("lastName", checkoutValues.lastName, { shouldValidate: true });
      setValue("phone", checkoutValues.phone, { shouldValidate: true });
      setValue("address", checkoutValues.address, { shouldValidate: true });
      setValue("city", checkoutValues.city, { shouldValidate: true });
      setValue("state", checkoutValues.state, { shouldValidate: true });
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
      void trackCheckoutRouteStarted({ items, subtotal });
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
        address: getValues("address"),
        city: getValues("city"),
        state: getValues("state"),
        notes: getValues("notes"),
      },
      { keepDirtyValues: true },
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
    .join(", ");
  const openNewAddressEditor = () => {
    if (selectedSavedAddressId) {
      setValue("address", "", { shouldValidate: false });
      setValue("city", "", { shouldValidate: false });
      setValue("state", "", { shouldValidate: false });
    }
    setSelectedSavedAddressId(null);
    setIsAddingNewAddress(true);
    setSaveAsDefaultAddress(savedAddresses.length <= 1);
  };

  const handleDeliveryAddressTextChange = (
    text: string,
    updateAddress: (value: string) => void,
  ) => {
    updateAddress(text);
    // If the user edits after committing via autocomplete, invalidate the
    // resolved context key so the next state/city change fetches fresh rates.
    if (committedAddress) {
      setResolvedShippingQuoteContextKey("");
    }
    setCommittedAddress("");
  };

  const handleDeliveryAddressSelect = (
    place: PlaceDetails,
    updateAddress: (value: string) => void,
  ) => {
    const selectedAddress = place.formattedAddress || "";
    updateAddress(selectedAddress);
    setCommittedAddress(selectedAddress);
    const normalizedState = place.state
      ? normalizeStateName(place.state, shippingStates)
      : "";

    if (place.city) {
      const normalizedCity = place.city.trim().toLowerCase();
      if (normalizedState && normalizedCity === normalizedState.toLowerCase()) {
        googleSuggestedCityRef.current = "";
      } else {
        googleSuggestedCityRef.current = place.city;
      }
    }

    setValue("city", "", { shouldValidate: false });
    if (normalizedState) {
      setValue("state", normalizedState, { shouldValidate: true });
    }
  };

  const getAvailableMethodsForTab = (tab: PaymentTab) =>
    availablePaymentMethods.filter(
      (method) => getPaymentTabForMethod(method) === tab,
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
      (method) => getPaymentTabForMethod(method) === paymentTab,
    );
    const paymentStillAvailable =
      availablePaymentMethods.includes(selectedPayment);

    if (!paymentStillAvailable) {
      const fallbackMethod =
        currentTabMethods[0] ?? availablePaymentMethods[0] ?? "paystack";
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
          (["full", "installments", "pay_later"] as const).find((tab) =>
            availablePaymentMethods.some(
              (method) => getPaymentTabForMethod(method) === tab,
            ),
          ) ?? "full";
        setPaymentTab(fallbackTab);
        const nextMethod = availablePaymentMethods.find(
          (method) => getPaymentTabForMethod(method) === fallbackTab,
        );
        if (nextMethod) setSelectedPayment(nextMethod);
      }
    }
  }, [availablePaymentMethods, selectedPayment, paymentTab]);

  const handleBack = () => {
    if (step === "payment") {
      setStep("address");
    } else if (step === "review") {
      setStep("payment");
    } else {
      router.back();
    }
  };

  const handleHardwareBackPress = useEffectEvent(() => {
    if (isOrderInFlight.current) {
      return true;
    }
    if (step === "address") {
      Alert.alert(
        "Leave Checkout?",
        "Your cart items will be saved. Are you sure you want to leave?",
        [
          { text: "Stay", style: "cancel" },
          {
            text: "Leave",
            style: "destructive",
            onPress: () => router.back(),
          },
        ],
      );
      return true;
    }

    if (step === "payment") {
      setStep("address");
    } else if (step === "review") {
      setStep("payment");
    } else {
      router.back();
    }

    return true;
  });

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      handleHardwareBackPress,
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
          withTiming(0, { duration: 800 }),
        ),
        -1,
        true,
      ),
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
      setSelectedQuoteId("");
      setResolvedShippingQuoteContextKey("");
      return;
    }
    const controller = new AbortController();
    setShippingCities([]);
    setIsLoadingCities(true);
    const fetchCities = async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/shipping/locations?state=${encodeURIComponent(
            watchedState,
          )}`,
          { signal: controller.signal },
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
                .map((location) => location.city),
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

    if (suggestedCity === "") {
      // State = City edge case: open picker for user to search
      setShowCityPicker(true);
      return;
    }

    // Search for a case-insensitive match in the Topship cities list
    const match = shippingCities.find(
      (c) => c.toLowerCase() === suggestedCity.toLowerCase(),
    );

    if (match) {
      // Perfect match - auto-select it
      setValue("city", match, { shouldValidate: true });
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
    if (deliveryMethod !== "door") {
      shippingQuoteAbortRef.current = null;
      setIsLoadingQuotes(false);
      setShippingQuotes([]);
      setSelectedQuoteId("");
      setResolvedShippingQuoteContextKey("");
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
      setSelectedQuoteId("");
      setResolvedShippingQuoteContextKey("");
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
    (quote) => String(quote.id) === String(selectedQuoteId),
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
            (item.assuranceRate ?? DEFAULT_ASSURANCE_RATE),
        )
      );
    }
    return sum;
  }, 0);

  useEffect(() => {
    const fetchTotals = async () => {
      try {
        const taxRate = getMerchantTaxRate(paymentSettings);
        const result = await calculateCommerce("calculate_order", {
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
  const liveSavingsSelectionForWalletFundedBankTransfer =
    getLiveSavingsSelection({
      isStoreCreditCompatible: true,
      items,
      orderTotal: total,
    });
  const walletFundedBankTransferResidual = Math.max(
    total - (liveSavingsSelectionForWalletFundedBankTransfer?.amount ?? 0),
    0,
  );
  const walletFundedBankTransferOptionEnabled =
    isEligibleForWalletFundedBankTransfer({
      customerId: customer?.id,
      customerPhone: customer?.phone,
      isAuthenticated,
      residualAfterSavings: walletFundedBankTransferResidual,
      walletBalance,
      walletOrderAutoDebitEnabled,
    });
  const isStoreCreditCompatibleForKlumpGate = isStoreCreditCompatiblePayment({
    paymentTab,
    selectedPayment,
  });
  const liveSavingsSelectionForKlumpGate = getLiveSavingsSelection({
    isStoreCreditCompatible: isStoreCreditCompatibleForKlumpGate,
    items,
    orderTotal: total,
  });
  const walletResidualForKlumpGate = Math.max(
    total - (liveSavingsSelectionForKlumpGate?.amount ?? 0),
    0,
  );
  const liveWalletSelectionForKlumpGate: WalletSelection | undefined =
    walletSelection?.use === true && isStoreCreditCompatibleForKlumpGate
      ? {
          use: true,
          amount: Math.max(
            0,
            Math.min(walletBalance, walletResidualForKlumpGate),
          ),
        }
      : undefined;
  const klumpDisabledReason = getKlumpDisabledReason(
    paymentSettings,
    total,
    liveWalletSelectionForKlumpGate,
    liveSavingsSelectionForKlumpGate,
  );
  // Show subtotal + delivery + assurance (no VAT) in steps 1 & 2; full total (with VAT) in Review
  const displayTotal =
    step === "review" ? total : subtotal + deliveryFee + assuranceFee;

  const onAddressSubmit = (data: ShippingAddressInput) => {
    trackCheckoutStep("shipping_info", {
      state: data.state,
      city: data.city,
    });
    setStep("payment");
  };

  const handleAddressValidationError = (
    errors: FieldErrors<ShippingAddressInput>,
  ) => {
    const hasContactErrors = Boolean(
      errors.firstName || errors.lastName || errors.phone || errors.email,
    );
    const hasDeliveryErrors = Boolean(
      errors.address || errors.city || errors.state,
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
            ? "Please complete your delivery address before continuing."
            : "Please complete your contact details before continuing.";

    Alert.alert("Incomplete Details", message, [{ text: "OK" }]);
  };

  const handleContinue = () => {
    Keyboard.dismiss();

    if (step === "address") {
      if (deliveryMethod === "pickup_station") {
        // For pickup station, supply the fixed address to the form for validation
        // without persisting it as the user's door address via setCommittedAddress.
        setValue("address", PICKUP_STATION_ADDRESS_LINES.join(", "), {
          shouldValidate: true,
        });
        setValue("city", PICKUP_STATION_CITY, { shouldValidate: true });
        setValue("state", PICKUP_STATION_STATE, { shouldValidate: true });
        handleSubmit(onAddressSubmit, handleAddressValidationError)();
      } else {
        handleSubmit(onAddressSubmit, handleAddressValidationError)();
      }
    } else if (step === "payment") {
      if (!selectedPayment) {
        Alert.alert(
          "Select Payment Method",
          "Choose how you want to pay before continuing to review.",
        );
        return;
      }
      trackCheckoutStep("payment_method", {
        payment_method: selectedPayment,
      });
      void trackCheckoutRoutePaymentInfo(selectedPayment);
      setStep("review");
    }
  };

  const handleSelectDeliveryMethod = (method: DeliveryMethod) => {
    if (method === "pickup_station" && deliveryMethod !== "pickup_station") {
      savedDoorAddressRef.current = {
        address: watchedAddress,
        city: watchedCity,
        state: watchedState,
      };
    } else if (
      method !== "pickup_station" &&
      deliveryMethod === "pickup_station"
    ) {
      const saved = savedDoorAddressRef.current;
      if (saved) {
        setValue("address", saved.address, { shouldValidate: false });
        setValue("city", saved.city, { shouldValidate: false });
        setValue("state", saved.state, { shouldValidate: false });
        setCommittedAddress(saved.address);
        savedDoorAddressRef.current = null;
      }
    }
    setDeliveryMethod(method);
  };

  const handleSelectState = (state: string) => {
    setValue("state", state, { shouldValidate: true });
    setValue("city", "", { shouldValidate: true });
    setShowStatePicker(false);
  };

  const handleSelectCity = (city: string) => {
    setValue("city", city, { shouldValidate: true });
    setShowCityPicker(false);
    setCitySearch("");
  };

  const handleCryptoConfirm = async (chain: string, currency: string) => {
    if (!pendingOrder) return;

    // Re-validate that the crypto payment amount still matches the current
    // order total before initiating payment (Bug #25 fix)
    const { orderResponse: pendingResponse } = pendingOrder;
    if (pendingResponse.amountDueToGateway !== total) {
      Alert.alert(
        "Amount Changed",
        "Your order total has changed since the order was created. Please go back and try again.",
        [{ text: "OK" }],
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
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": `crypto-init-${order.id}-${chain}-${currency}`,
          },
          body: JSON.stringify({
            merchant_id: MERCHANT_ID,
            order_id: order.id,
            amount: orderResponse.amountDueToGateway,
            currency: "NGN",
            customer_email: customerEmail,
            customer_name: customerName,
            customer_phone: customerPhone,
            gateway: "juicyway",
            crypto_chain: chain,
            crypto_currency: currency,
          }),
        },
      );

      const initData = await initResponse.json();

      if (!initResponse.ok || !initData.success) {
        throw new OrderError(
          initData.error || "Failed to initialize crypto payment",
          "PAYMENT_INIT_ERROR",
        );
      }

      if (!initData.crypto_payment?.address) {
        throw new OrderError(
          "Failed to generate crypto wallet address. Please try again.",
          "PAYMENT_INIT_ERROR",
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
        cryptoAmount: cp.crypto_amount || "",
        confirmationTime: cp.confirmation_time || "",
        reference: initData.reference || "",
        paymentId: cp.payment_id || "",
        trackingToken,
      });
    } catch (error) {
      setIsProcessing(false);
      setShowCryptoSelection(false);
      isOrderInFlight.current = false;
      if (error instanceof OrderError) {
        Alert.alert("Payment Error", error.message);
      } else {
        Alert.alert("Error", "Failed to initialize payment");
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
        "Empty Cart",
        "Your cart is empty. Please add items before checking out.",
        [{ text: "OK", onPress: () => router.replace("/") }],
      );
      return;
    }

    if (isOrderInFlight.current || isProcessing) {
      return;
    }

    if (isLoadingQuotes) {
      Alert.alert(
        "Still Fetching Delivery",
        "Please wait for delivery options to finish loading before placing your order.",
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
        "Payment Method Unavailable",
        "The selected payment method is no longer available. Please choose another.",
        [{ text: "OK", onPress: () => setStep("payment") }],
      );
      return;
    }

    // Validate that a shipping quote is selected when shipping quotes are
    // available (i.e. the address step fetched quotes for the chosen location)
    const requiresFreshShippingQuote =
      deliveryMethod === "door" && Boolean(currentShippingQuoteContextKey);
    const hasFreshShippingQuoteSelection =
      resolvedShippingQuoteContextKey === currentShippingQuoteContextKey &&
      Boolean(selectedQuote);

    if (requiresFreshShippingQuote && !hasFreshShippingQuoteSelection) {
      Alert.alert(
        "Shipping Required",
        "Please confirm a delivery option before placing your order.",
        [{ text: "OK", onPress: () => setStep("address") }],
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
    // Match the screen-level `total` (line ~1487:
    //   subtotal + deliveryFee + assuranceFee + taxAmount)
    // so the wallet row in the picker (which reads `total`) and the
    // submitted wallet_amount agree. Without the assurance leg, an
    // insured "full wallet" order would still owe the assurance fee to
    // the gateway, breaking the wallet-only bypass and forcing an extra
    // payment step.
    const snapshotAssuranceFee = itemsSnapshot.reduce((sum, item) => {
      if (!item.hasAssurance) {
        return sum;
      }
      const effectivePrice = item.negotiatedPrice ?? item.price;
      return (
        sum +
        Math.round(
          effectivePrice *
            item.quantity *
            (item.assuranceRate ?? DEFAULT_ASSURANCE_RATE),
        )
      );
    }, 0);
    const snapshotTotal =
      snapshotSubtotal +
      snapshotDeliveryFee +
      snapshotAssuranceFee +
      snapshotTaxAmount;
    // Recompute savings and wallet amounts at submit time against the
    // snapshotted cart total, ignoring captured selection amounts. Between
    // toggle and submit, totals can shift (shipping quote update, tax
    // recompute) and balances can move (concurrent refunds / cashback).
    // Savings is applied first, then wallet can cover only the residual.
    //
    // Also enforce the same payment-method gate the picker uses
    // (PaymentMethodSelector.tsx → walletShouldRender). If the user
    // toggled wallet on while a compatible method was selected and then
    // switched to an incompatible one (BNPL / pay-later / pay_on_delivery
    // / juicyway / invoice / payforme), the picker hides the row but
    // walletSelection.use is still true. Drop the wallet payload here so
    // the API doesn't receive a stale wallet redemption that would either
    // be silently ignored (BNPL/pay_later branch) or break the Juicyway
    // amount-drift guard in handleCryptoConfirm.
    const isStoreCreditCompatibleSubmit = isStoreCreditCompatiblePayment({
      paymentTab,
      selectedPayment,
    });
    const liveSavingsSelection = getLiveSavingsSelection({
      isStoreCreditCompatible: isStoreCreditCompatibleSubmit,
      items: itemsSnapshot,
      orderTotal: snapshotTotal,
    });
    const liveSavingsAmount = liveSavingsSelection?.amount ?? 0;
    const walletResidualAfterSavings = Math.max(
      snapshotTotal - liveSavingsAmount,
      0,
    );
    const shouldCreateWalletFundedBankTransferOrder =
      selectedPayment === "bank_transfer" &&
      isEligibleForWalletFundedBankTransfer({
        customerId: customer?.id,
        customerPhone: customer?.phone,
        isAuthenticated,
        residualAfterSavings: walletResidualAfterSavings,
        walletBalance,
        walletOrderAutoDebitEnabled,
      });
    // walletAmountForOrder stays 0 for shouldCreateWalletFundedBankTransferOrder
    // because liveWalletSelection must not consume existing wallet credit when
    // walletOrderAutoDebitEnabled will fund the wallet and auto-debit the order.
    const walletAmountForOrder = shouldCreateWalletFundedBankTransferOrder
      ? 0
      : Math.max(0, Math.min(walletBalance, walletResidualAfterSavings));
    const liveWalletSelection: WalletSelection | undefined =
      walletSelection?.use === true &&
      isStoreCreditCompatibleSubmit &&
      walletAmountForOrder > 0
        ? {
            use: true,
            amount: walletAmountForOrder,
          }
        : undefined;

    try {
      trackCheckoutStep("review");

      // 2026 Fix: Use validated address from handleSubmit instead of getValues()
      // const address = getValues(); // Removed to prevent bypass
      const customerEmail = customer?.email || address.email;
      const customerPhone = address.phone;
      const customerName = `${address.firstName} ${address.lastName}`;
      const paymentMethodForOrder =
        selectedPayment === "payforme" ? "invoice" : selectedPayment;
      const orderShippingAddress =
        deliveryMethod === "pickup_station"
          ? {
              ...address,
              address: PICKUP_STATION_ADDRESS_LINES.join(", "),
              city: PICKUP_STATION_CITY,
              state: PICKUP_STATION_STATE,
            }
          : deliveryMethod === "airport"
            ? {
                ...address,
                address: address.address || "Airport Delivery (Outside Lagos)",
              }
            : address;

      const isBNPL =
        selectedPayment === "credpal" ||
        selectedPayment === "credit_direct" ||
        selectedPayment === "klump";

      if (isBNPL) {
        const klumpSubmitDisabledReason =
          selectedPayment === "klump"
            ? getKlumpDisabledReason(
                paymentSettings,
                snapshotTotal,
                liveWalletSelection,
                liveSavingsSelection,
              )
            : undefined;
        if (klumpSubmitDisabledReason) {
          Alert.alert("Klump unavailable", klumpSubmitDisabledReason, [
            { text: "OK" },
          ]);
          isOrderInFlight.current = false;
          setIsProcessing(false);
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
                    effectivePrice *
                      item.quantity *
                      (item.assuranceRate ?? DEFAULT_ASSURANCE_RATE),
                  )
                : 0,
            };
          }),
          subtotal: snapshotSubtotal,
          shipping_fee: snapshotDeliveryFee,
          tax_amount: snapshotTaxAmount,
          selected_quote_id:
            deliveryMethod === "door" && selectedQuote?.id != null
              ? String(selectedQuote.id)
              : undefined,
          shipping_provider: getShippingProviderForMethod(
            deliveryMethod,
            selectedQuote,
          ),
          payment_method: paymentMethodForOrder,
          shipping_address: orderShippingAddress,
          source: "mobile_app",
        });

        if (selectedPayment === "klump") {
          const orderTotal = Number(orderResponse.order.total);
          const initResponse = await fetch(
            `${API_BASE_URL}/api/payments/initialize`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Idempotency-Key": `payment-init-${orderResponse.order.id}-klump`,
              },
              body: JSON.stringify(
                buildKlumpInitializePayload({
                  customerEmail,
                  customerName,
                  customerPhone,
                  merchantId: MERCHANT_ID,
                  orderId: orderResponse.order.id,
                  orderTotal,
                }),
              ),
            },
          );

          const initData = await initResponse.json();
          if (
            !initResponse.ok ||
            !initData.success ||
            typeof initData.authorization_url !== "string" ||
            typeof initData.reference !== "string"
          ) {
            throw new OrderError(
              initData.error || "Failed to initialize Klump payment",
              "PAYMENT_INIT_ERROR",
            );
          }

          isOrderInFlight.current = false;
          setIsProcessing(false);
          router.push({
            pathname: "/bnpl-checkout",
            params: buildKlumpBnplRouteParams({
              amount: orderTotal,
              authorizationUrl: initData.authorization_url,
              customerEmail,
              customerName,
              customerPhone,
              orderId: orderResponse.order.id,
              reference: initData.reference,
              trackingToken: orderResponse.order.tracking_token,
            }),
          });
          return;
        }

        isOrderInFlight.current = false;
        setIsProcessing(false);
        router.push({
          pathname: "/bnpl-checkout",
          params: {
            orderId: orderResponse.order.id,
            gateway: selectedPayment,
            amount: String(orderResponse.amountDueToGateway),
            customerEmail,
            customerName,
            customerPhone,
            merchantSlug: MERCHANT_SLUG,
            ...(orderResponse.order.tracking_token && {
              trackingToken: orderResponse.order.tracking_token,
            }),
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
                  effectivePrice *
                    item.quantity *
                    (item.assuranceRate ?? DEFAULT_ASSURANCE_RATE),
                )
              : 0,
          };
        }),
        subtotal: snapshotSubtotal,
        shipping_fee: snapshotDeliveryFee,
        tax_amount: snapshotTaxAmount,
        selected_quote_id:
          deliveryMethod === "door" && selectedQuote?.id != null
            ? String(selectedQuote.id)
            : undefined,
        shipping_provider: getShippingProviderForMethod(
          deliveryMethod,
          selectedQuote,
        ),
        payment_method: paymentMethodForOrder,
        shipping_address: orderShippingAddress,
        source: "mobile_app",
        ...buildSavingsOrderFields(liveSavingsSelection),
        ...buildWalletOrderFields(liveWalletSelection),
      });

      const { order } = orderResponse;
      const orderNumber =
        order.order_number || order.id.slice(0, 8).toUpperCase();
      const routeToWalletFundedBankTransfer = (
        response: WalletOrderFundingIntentCreateResponse,
      ) => {
        isOrderInFlight.current = false;
        setIsProcessing(false);
        router.push({
          pathname: "/bank-transfer",
          params: {
            accountName: response.account.accountName,
            accountNumber: response.account.accountNumber,
            amount: String(response.intent.expectedAmount),
            bankName: response.account.bankName,
            intentId: response.intent.id,
            merchantId: MERCHANT_ID,
            merchantSlug: MERCHANT_SLUG,
            orderId: order.id,
            orderNumber,
            reference: response.intent.id,
            walletFunded: "true",
            ...(order.tracking_token && {
              trackingToken: order.tracking_token,
            }),
          },
        });
      };
      const runPostOrderSideEffects = () => {
        void (async () => {
          if (isAuthenticated && customer?.id && saveAsDefaultAddress) {
            try {
              const { data, error } = await supabase
                .from("customers")
                .select("saved_addresses")
                .eq("id", customer.id)
                .eq("merchant_id", MERCHANT_ID)
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
                },
              );

              const { error: updateError } = await supabase
                .from("customers")
                .update({ saved_addresses: nextSavedAddresses })
                .eq("id", customer.id)
                .eq("merchant_id", MERCHANT_ID);

              if (updateError) throw updateError;
            } catch (error) {
              trackError(
                "checkout_save_default_address",
                error instanceof Error
                  ? error.message
                  : "Failed to save default address",
              );
            }
          }

          await scheduleLocalNotification(
            "Order Received! 📦",
            `Your order #${orderNumber} is being processed. We'll notify you when it ships.`,
            { type: "order_update", orderNumber, orderId: order.id },
            1,
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

      // When the server fully settled the order from wallet credit,
      // attribute the completion to 'wallet' in analytics rather than
      // the still-set selectedPayment value. Otherwise wallet-funded
      // orders skew payment dashboards as paystack/korapay/bank_transfer.
      const fullyPaidStoreCreditPaymentMethod =
        getFullyPaidStoreCreditPaymentMethod(orderResponse);
      const completedPaymentMethod =
        fullyPaidStoreCreditPaymentMethod ?? selectedPayment;
      void trackCheckoutRoutePurchaseCompleted({
        customerEmail,
        customerPhone,
        items: itemsSnapshot,
        orderId: order.id,
        orderNumber,
        paymentMethod: completedPaymentMethod,
        shipping: snapshotDeliveryFee,
        subtotal: snapshotSubtotal,
        tax: snapshotTaxAmount,
        total: order.total,
        userId: user?.id,
      });

      // Route based on payment method
      const isOnlinePayment =
        selectedPayment === "paystack" || selectedPayment === "korapay";
      const isBankTransfer = selectedPayment === "bank_transfer";
      const isJuicyway = selectedPayment === "juicyway";

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

      // Store-credit short-circuit: when the server has already finalized
      // the order from wallet and/or savings credit, skip the gateway
      // initialize hop and navigate to success directly.
      if (fullyPaidStoreCreditPaymentMethod) {
        clearCart();
        const persistOpts = useCartStore.persist.getOptions();
        const partialize = persistOpts.partialize ?? ((s: unknown) => s);
        const persistedState = partialize(useCartStore.getState());
        await AsyncStorage.setItem(
          persistOpts.name ?? "cart-storage",
          JSON.stringify({
            state: persistedState,
            version: persistOpts.version ?? 0,
          }),
        );
        setIsProcessing(false);
        router.replace({
          pathname: "/order-success",
          params: {
            orderId: order.id,
            orderNumber,
            paymentMethod: fullyPaidStoreCreditPaymentMethod,
            savingsAmountUsed: String(orderResponse.savings?.amountUsed ?? 0),
            walletAmountUsed: String(orderResponse.wallet?.amountUsed ?? 0),
            ...(order.tracking_token && {
              trackingToken: order.tracking_token,
            }),
          },
        });
        runPostOrderSideEffects();
        return;
      }

      if (isOnlinePayment || isBankTransfer) {
        if (isBankTransfer && shouldCreateWalletFundedBankTransferOrder) {
          const startedWalletFundedBankTransfer =
            await createWalletFundedBankTransferIntent({
              merchantId: MERCHANT_ID,
              merchantSlug: MERCHANT_SLUG,
              onFallback: ({ code, consent, message }) => {
                trackError("wallet_order_funding_intent_failed", message, {
                  code,
                  ...(consent ? { consent: true } : {}),
                  orderId: order.id,
                });
                Alert.alert(
                  "Bank transfer unavailable",
                  "Bank transfer to wallet is temporarily unavailable. We will use the standard bank transfer option instead.",
                  [{ text: "OK" }],
                );
              },
              onSuccess: routeToWalletFundedBankTransfer,
              orderId: order.id,
              requestConsent: requestWalletFundingAccountConsent,
            });
          if (startedWalletFundedBankTransfer) {
            runPostOrderSideEffects();
            return;
          }
        }

        // Initialize payment gateway
        const gateway = isBankTransfer ? "paystack" : selectedPayment;
        const initResponse = await fetch(
          `${API_BASE_URL}/api/payments/initialize`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": `payment-init-${order.id}-${gateway}`,
            },
            body: JSON.stringify({
              merchant_id: MERCHANT_ID,
              order_id: order.id,
              amount: orderResponse.amountDueToGateway,
              currency: "NGN",
              customer_email: customerEmail,
              customer_name: customerName,
              customer_phone: customerPhone,
              gateway,
              ...(isBankTransfer && { payment_type: "dva" }),
            }),
          },
        );

        const initData = await initResponse.json();

        if (!initResponse.ok || !initData.success) {
          throw new OrderError(
            initData.error || "Failed to initialize payment",
            "PAYMENT_INIT_ERROR",
          );
        }

        setIsProcessing(false);

        if (isBankTransfer) {
          isOrderInFlight.current = false;
          router.push({
            pathname: "/bank-transfer",
            params: {
              orderId: order.id,
              orderNumber,
              reference: initData.reference,
              amount: String(orderResponse.amountDueToGateway),
              bankName:
                initData.dva?.bank_name ||
                initData.virtual_account?.bank_name ||
                "",
              accountNumber:
                initData.dva?.account_number ||
                initData.virtual_account?.account_number ||
                "",
              accountName:
                initData.dva?.account_name ||
                initData.virtual_account?.account_name ||
                "",
              ...(order.tracking_token && {
                trackingToken: order.tracking_token,
              }),
            },
          });
        } else {
          const authUrl = initData.authorization_url || initData.checkout_url;
          router.push({
            pathname: "/payment-gateway",
            params: {
              orderId: order.id,
              orderNumber,
              gateway: selectedPayment,
              authorizationUrl: authUrl,
              reference: initData.reference,
              amount: String(orderResponse.amountDueToGateway),
              ...(order.tracking_token && {
                trackingToken: order.tracking_token,
              }),
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
        persistOpts.name ?? "cart-storage",
        JSON.stringify({
          state: persistedState,
          version: persistOpts.version ?? 0,
        }),
      );

      // Navigate to success after cart is cleared
      router.replace({
        pathname: "/order-success",
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
        trackError("checkout_failed", error.message, {
          step: "place_order",
          paymentMethod: selectedPayment,
          errorCode: error.code,
        });

        switch (error.code) {
          case "NETWORK_ERROR":
            Alert.alert(
              "No Connection",
              "Please check your internet connection and try again.",
              [{ text: "OK" }],
            );
            break;
          case "VALIDATION_ERROR":
            Alert.alert(
              "Invalid Information",
              error.message || "Please check your order details and try again.",
              [{ text: "OK" }],
            );
            break;
          case "AUTH_ERROR":
            Alert.alert(
              "Session Expired",
              "Please sign in again to complete your order.",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Sign In", onPress: () => router.push("/auth/login") },
              ],
            );
            break;
          default:
            Alert.alert(
              "Order Failed",
              error.message || "Something went wrong. Please try again.",
              [{ text: "OK" }],
            );
        }
      } else {
        trackError(
          "checkout_failed",
          error instanceof Error ? error.message : "Unknown error",
          { step: "place_order", paymentMethod: selectedPayment },
        );
        Alert.alert("Error", "Failed to place order. Please try again.", [
          { text: "OK" },
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
      "Incomplete Details",
      "Please fill in all required fields (Address, City, Phone) to place your order.",
      [{ text: "OK" }],
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
            ? "Choose how this order should be delivered."
            : "Add your contact and delivery details to continue."}
        </Text>
      </View>

      <CheckoutContactCard
        accountPassword={accountPassword}
        colors={colors}
        contactSummary={currentContactSummary}
        control={control}
        email={watchedEmail}
        errors={errors}
        hasContactIdentity={hasContactIdentity}
        isAuthenticated={isAuthenticated}
        isCollapsed={isContactCollapsed}
        isDark={isDark}
        onChangeAccountPassword={setAccountPassword}
        onToggleCollapsed={() => setIsContactCollapsed((value) => !value)}
        onToggleSaveDetails={() => setSaveDetails(!saveDetails)}
        phone={watchedPhone}
        saveDetails={saveDetails}
      />

      <DeliveryMethodCard
        colors={colors}
        isDark={isDark}
        selectedMethod={deliveryMethod}
        onSelectMethod={handleSelectDeliveryMethod}
        doorSubtitle={
          selectedQuote != null
            ? getDeliveryMethodSummary("door", selectedQuote)
            : "Rates loaded after you enter your address"
        }
        doorPrice={
          selectedQuote != null ? formatPrice(selectedQuote.price) : "—"
        }
        airportFee={AIRPORT_DELIVERY_FEE}
      />

      {deliveryMethod !== "pickup_station" && (
        <CheckoutDeliveryCard
          colors={colors}
          control={control}
          currentDeliverySummary={currentDeliverySummary}
          defaultSavedAddress={defaultSavedAddress}
          errors={errors}
          hasSavedAddresses={hasSavedAddresses}
          isAddingNewAddress={isAddingNewAddress}
          isAuthenticated={isAuthenticated}
          isCollapsed={isDeliveryCollapsed}
          isDark={isDark}
          isLoadingCities={isLoadingCities}
          isLoadingLocations={isLoadingLocations}
          isLoadingSavedAddresses={isLoadingSavedAddresses}
          onAddressSelected={handleDeliveryAddressSelect}
          onAddressTextChanged={handleDeliveryAddressTextChange}
          onOpenCityPicker={() => setShowCityPicker(true)}
          onOpenNewAddressEditor={openNewAddressEditor}
          onOpenStatePicker={() => setShowStatePicker(true)}
          onToggleCollapsed={() => setIsDeliveryCollapsed((value) => !value)}
          onToggleSaveAsDefaultAddress={() =>
            setSaveAsDefaultAddress((value) => !value)
          }
          onUseSavedAddress={applySavedAddressToForm}
          saveAsDefaultAddress={saveAsDefaultAddress}
          savedAddresses={savedAddresses}
          scrollOffsetRef={addressScrollOffsetRef}
          scrollRef={addressScrollRef}
          selectedSavedAddress={selectedSavedAddress}
          selectedSavedAddressId={selectedSavedAddressId}
        />
      )}

      {deliveryMethod === "pickup_station" && (
        <PickupStationCard colors={colors} isDark={isDark} />
      )}

      {deliveryMethod === "door" && watchedState && watchedCity && (
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
        <CheckoutFormField
          name="notes"
          label=""
          placeholder="Any special instructions for delivery"
          multiline
          control={control}
          errors={errors}
          colors={colors}
          isDark={isDark}
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

      {checkoutSavingsError ? (
        <CheckoutSavingsRetryCard
          colors={colors}
          isDark={isDark}
          message={checkoutSavingsError}
          onRetry={reloadCheckoutSavings}
        />
      ) : null}

      <PaymentMethodSelector
        selectedMethod={selectedPayment}
        onSelectMethod={setSelectedPayment}
        selectedTab={paymentTab}
        onSelectTab={handleSelectPaymentTab}
        orderTotal={total}
        enabledMethods={availablePaymentMethods}
        walletMode="orders"
        walletBalance={walletBalance}
        walletOrderTotal={total}
        walletSelection={walletSelection}
        onWalletToggle={setWalletSelection}
        savingsBalance={isLoadingCheckoutSavings ? 0 : checkoutSavingsBalance}
        savingsGoalId={checkoutSavingsGoal?.id ?? null}
        savingsGoalTitle={checkoutSavingsGoal?.title}
        savingsSelection={savingsSelection}
        onSavingsToggle={setSavingsSelection}
        walletFundedBankTransferMode={
          walletFundedBankTransferOptionEnabled &&
          selectedPayment === "bank_transfer"
        }
        methodLabelOverrides={
          walletFundedBankTransferOptionEnabled
            ? { bank_transfer: "Bank transfer to wallet" }
            : undefined
        }
        methodDescriptionOverrides={
          walletFundedBankTransferOptionEnabled
            ? {
                bank_transfer:
                  "Transfer to your Bassey wallet account. We apply it to this order automatically.",
              }
            : undefined
        }
        methodDisabledReasons={
          klumpDisabledReason ? { klump: klumpDisabledReason } : undefined
        }
      />
    </ScrollView>
  );

  const renderReview = () => (
    <CheckoutReviewStep
      address={getValues()}
      assuranceFee={assuranceFee}
      colors={colors}
      deliveryFee={deliveryFee}
      deliveryMethod={deliveryMethod}
      formContentPaddingBottom={formContentPaddingBottom}
      isDark={isDark}
      items={items}
      onEditAddress={() => setStep("address")}
      onEditPayment={() => setStep("payment")}
      selectedPayment={selectedPayment}
      selectedQuote={selectedQuote}
      subtotal={subtotal}
      taxAmount={orderTotals?.taxAmount ?? null}
      taxRate={getMerchantTaxRate(paymentSettings)}
      total={total}
    />
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["top", "left", "right"]}
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

          {step === "address" && renderAddressForm()}
          {step === "payment" && renderPaymentOptions()}
          {step === "review" && renderReview()}

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
                  {items.length} item{items.length === 1 ? "" : "s"}
                </Text>
              </View>

              {step === "review" ? (
                <Pressable
                  style={[
                    styles.actionButton,
                    { backgroundColor: BRAND.primary },
                  ]}
                  onPress={handlePlaceOrder}
                  disabled={isProcessing}
                  accessibilityRole="button"
                  accessibilityLabel={`${selectedPayment === "invoice" ? "Generate invoice" : selectedPayment === "payforme" ? "Prepare pay for me order" : "Place order"} for ${formatPrice(total)}`}
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
                        {selectedPayment === "invoice"
                          ? "Generate Invoice"
                          : selectedPayment === "payforme"
                            ? "Pay for Me"
                            : "Place Order"}
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
                  accessibilityLabel={`Continue to ${step === "address" ? "payment" : "review"}`}
                >
                  <Text style={styles.actionButtonText}>Continue</Text>
                  <Animated.View style={animatedCtaArrowStyle}>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                  </Animated.View>
                </Pressable>
              )}
            </View>
          </View>
        </AppKeyboardContainer>
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
              removeClippedSubviews={Platform.OS === "android"}
              renderItem={({ item }) => (
                <Pressable
                  style={[
                    styles.pickerItem,
                    { borderBottomColor: colors.border },
                    item === watchedState && {
                      backgroundColor: isDark
                        ? "rgba(217, 59, 48, 0.14)"
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
                                ? "#FDECEA"
                                : BRAND.primary
                              : colors.text,
                          fontWeight: item === watchedState ? "700" : "500",
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
          setCitySearch("");
        }}
      >
        <AppKeyboardContainer style={styles.pickerOverlay}>
          <View style={[styles.pickerSheet, { backgroundColor: colors.card }]}>
            <View style={styles.pickerHeader}>
              <Text style={[styles.pickerTitle, { color: colors.text }]}>
                Select City
              </Text>
              <Pressable
                onPress={() => {
                  setShowCityPicker(false);
                  setCitySearch("");
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
                    ? "rgba(255, 255, 255, 0.05)"
                    : "#F9FAFB",
                  borderColor: citySearchFocused
                    ? BRAND.primary
                    : "transparent",
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
                <Pressable onPress={() => setCitySearch("")} hitSlop={8}>
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
                      c.toLowerCase().includes(citySearch.toLowerCase()),
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
              removeClippedSubviews={Platform.OS === "android"}
              renderItem={({ item }) => (
                <Pressable
                  style={[
                    styles.pickerItem,
                    { borderBottomColor: colors.border },
                    item === watchedCity && {
                      backgroundColor: isDark
                        ? "rgba(217, 59, 48, 0.14)"
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
                                ? "#FDECEA"
                                : BRAND.primary
                              : colors.text,
                          fontWeight: item === watchedCity ? "700" : "500",
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
        </AppKeyboardContainer>
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
                    "Close Payment?",
                    "If you've already sent crypto, your order will still be processed once the payment is detected on the blockchain.",
                    [
                      { text: "Stay", style: "cancel" },
                      {
                        text: "Close",
                        onPress: () => {
                          setCryptoPayment(null);
                        },
                      },
                    ],
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
                    (cryptoPayment.amount / 100).toLocaleString()}{" "}
                  <Text style={{ color: BRAND.primary }}>
                    {cryptoPayment.currency}
                  </Text>
                </Text>
                <View style={styles.cryptoChainBadge}>
                  <View style={styles.cryptoPulseDot} />
                  <Text style={styles.cryptoChainText}>
                    Network:{" "}
                    {{
                      TRX: "Tron (TRC-20)",
                      ETH: "Ethereum (ERC-20)",
                      MATIC: "Polygon",
                      AVAXC: "Avalanche C-Chain",
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
                          copiedCryptoField === "address"
                            ? `${palette.emerald[500]}15`
                            : `${BRAND.primary}15`,
                      },
                    ]}
                    onPress={async () => {
                      const success = await setClipboardString(
                        cryptoPayment.address,
                      );
                      if (success) {
                        setCopiedCryptoField("address");
                        if (cryptoCopyTimerRef.current)
                          clearTimeout(cryptoCopyTimerRef.current);
                        cryptoCopyTimerRef.current = setTimeout(
                          () => setCopiedCryptoField(null),
                          2000,
                        );
                      }
                    }}
                  >
                    <Ionicons
                      name={
                        copiedCryptoField === "address"
                          ? "checkmark"
                          : "copy-outline"
                      }
                      size={18}
                      color={
                        copiedCryptoField === "address"
                          ? "#059669"
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
                  Only send {cryptoPayment.currency} on the{" "}
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
                    pathname: "/order-success",
                    params: {
                      orderId,
                      orderNumber,
                      paymentMethod: "juicyway",
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
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  screenHeaderTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
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
    fontWeight: "700",
  },
  sectionSubtitle: {
    fontSize: 13,
    marginTop: 6,
  },
  helperText: {
    fontSize: 12,
  },
  bottomAction: {
    position: "absolute",
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
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  bottomSummary: {
    minWidth: 120,
  },
  bottomLabel: {
    fontSize: 11,
    color: palette.gray[500],
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  bottomValue: {
    fontSize: 18,
    fontWeight: "800",
    color: palette.gray[900],
  },
  bottomSubtle: {
    fontSize: 12,
    marginTop: 2,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: RADIUS.xl,
    flex: 1,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  processingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  pickerSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: "70%",
  },
  pickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  pickerItem: {
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    borderRadius: 12,
    justifyContent: "center",
  },
  pickerItemContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  citySearchInput: {
    flex: 1,
    fontSize: 14,
  },
  saveDetailsSection: {
    gap: SPACING.sm,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
    minHeight: 44,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: BRAND.primary,
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  accountInfoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  cryptoHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  cryptoHeaderTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  cryptoBackBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  cryptoCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  cryptoContent: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  cryptoAmountCard: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    gap: 4,
  },
  cryptoAmountLabel: {
    fontSize: 13,
  },
  cryptoAmountValue: {
    fontSize: 28,
    fontWeight: "700",
  },
  cryptoChainBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
  },
  cryptoPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22C55E",
  },
  cryptoChainText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
  },
  cryptoAddressCard: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    gap: SPACING.sm,
  },
  cryptoFieldLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9CA3AF",
    letterSpacing: 0.5,
  },
  cryptoAddressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  cryptoAddressText: {
    flex: 1,
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    lineHeight: 20,
  },
  cryptoCopyBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  cryptoWarning: {
    flexDirection: "row",
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: "#FFF8E1",
  },
  cryptoWarningText: {
    flex: 1,
    fontSize: 12,
    color: "#92400E",
    lineHeight: 18,
  },
  cryptoInfoCard: {
    flexDirection: "row",
    alignItems: "center",
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
    textAlign: "center",
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
    alignItems: "center",
  },
  cryptoDoneBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  cryptoHelpText: {
    textAlign: "center",
    fontSize: 12,
    lineHeight: 16,
  },
});
