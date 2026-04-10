/**
 * Order Details Screen
 * Premium design with real-time data and actionable controls
 */

import {
  BRAND_COLORS,
  PAYMENT_STATUS_CONFIG,
  SHIPPING_STATUS_ACTIONS,
  SHIPPING_STATUS_CONFIG,
} from '@baci/shared';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

// 2026 Best Practice: Dynamic imports for native modules to prevent evaluation-time crashes
let Print: typeof import('expo-print') | null = null;
let Sharing: typeof import('expo-sharing') | null = null;

const loadNativeModules = async () => {
  if (Platform.OS === 'web') return;
  try {
    const [prnt, shr] = await Promise.all([
      import('expo-print'),
      import('expo-sharing'),
    ]);
    Print = prnt;
    Sharing = shr;
  } catch (_e) {
    console.debug('[OrderDetails] Native modules ignored or failed to load');
  }
};

loadNativeModules();

import type { ReceiptMerchant, ReceiptOrder } from '@baci/shared';
import { generateReceiptHtml, getBankNameFromCode } from '@baci/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { z } from 'zod';
import {
  OrderItemDetailModal,
  type OrderItemSnapshot,
} from '@/components/orders/OrderItemDetailModal';
import { InvalidRouteScreen } from '@/components/ui/InvalidRouteScreen';
import { KeyboardAwareModalContainer } from '@/components/ui/KeyboardAwareModalContainer';
import { ReceiptPreviewModal } from '@/components/ui/ReceiptPreviewModal';
import SafeImage from '@/components/ui/SafeImage';
import { SuccessModal } from '@/components/ui/SuccessModal';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useMerchant } from '@/hooks/useMerchant';
import {
  type PaymentStatus,
  type ShippingStatus,
  useOrder,
  useRecordPayment,
  useSendReminder,
  useShipOnCredit,
  useUpdateOrderStatus,
} from '@/hooks/useOrders';
import { useTheme } from '@/hooks/useTheme';
import { BASE_URL } from '@/lib/api-client';
import { extractOrderDeliveryAddress } from '@/lib/orders';
import { supabase } from '@/lib/supabase';
import { parseSavedRiders } from '@/lib/validators/storage';

// Route param validation - order ID must be a valid UUID
const routeParamsSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(['record-payment', 'ship-on-credit']).optional(),
});

type ShippingAddressObject = {
  address?: string | null;
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
};

type ShippingAddress = ShippingAddressObject | string | null | undefined;
type ShipmentCompletionMode = 'provider' | 'self_fulfillment';

// Helper to get consistent theme colors for statuses
const getStatusColor = (
  key: string | undefined,
  colors: Record<string, string>
) => {
  const colorMap: Record<string, string> = {
    pending: colors.pending,
    processing: colors.processing,
    shipped: colors.shipped,
    delivered: colors.delivered,
    cancelled: colors.cancelled,
    returned: colors.returned || colors.textMuted,
    paid: colors.success,
    unpaid: colors.error,
    refunded: colors.textMuted,
  };
  return colorMap[key || ''] || colors.textSecondary;
};

// Status Transition Logic
const isStatusActionAllowed = (
  currentStatus: string,
  targetStatus: string
): boolean => {
  if (currentStatus === targetStatus) return true; // Always allow keeping same status

  switch (currentStatus) {
    case 'pending':
    case 'fulfilled': // Handle legacy alias
      return ['processing', 'cancelled'].includes(targetStatus);
    case 'processing':
      return ['shipped', 'pending', 'cancelled'].includes(targetStatus);
    case 'shipped':
      // allow 'processing' to correct mistake, 'delivered' for next step, 'returned' if cancelled/rejected
      return ['delivered', 'processing', 'returned'].includes(targetStatus);
    case 'delivered':
      return ['shipped', 'returned'].includes(targetStatus); // shipped to correct mistake
    case 'cancelled':
      return ['pending'].includes(targetStatus); // Re-open order
    case 'returned':
      return ['delivered', 'shipped'].includes(targetStatus); // Fix mistake
    default:
      // If we encounter an unknown status, allow moving to processing or cancelled as safety
      return ['pending', 'processing', 'cancelled'].includes(targetStatus);
  }
};

// Helper to get currency symbol from merchant's payout_currency
const getCurrencySymbol = (currencyCode: string | null | undefined) => {
  const symbols: Record<string, string> = {
    NGN: '\u20A6',
    USD: '$',
    GBP: '\u00A3',
    EUR: '\u20AC',
  };
  return symbols[currencyCode || 'NGN'] || '\u20A6';
};

export default function OrderDetailsScreen() {
  const rawParams = useLocalSearchParams<{
    id: string;
    action?: string;
  }>();
  const { colors, shadows } = useTheme();

  // Validate route params with Zod
  // Normalize array params to single values for validation
  const normalizedParams = {
    id: Array.isArray(rawParams.id) ? rawParams.id[0] : rawParams.id,
    action: Array.isArray(rawParams.action)
      ? rawParams.action[0]
      : rawParams.action,
  };
  const result = routeParamsSchema.safeParse(normalizedParams);
  const validatedParams = result.success ? result.data : null;

  // Extract validated values (will be undefined if validation fails)
  const orderId = validatedParams?.id;
  const actionParam = validatedParams?.action;

  // Data Fetching - use placeholder ID when invalid to maintain hook order
  const queryClient = useQueryClient();
  const { data: order, isLoading, error } = useOrder(orderId ?? '');
  const { merchant } = useMerchant();
  const merchantCurrency = merchant?.payout_currency || 'NGN';
  const currencySymbol = getCurrencySymbol(merchant?.payout_currency);
  const updateStatusMutation = useUpdateOrderStatus();
  const shipOnCreditMutation = useShipOnCredit();
  const sendReminderMutation = useSendReminder();
  const recordPaymentMutation = useRecordPayment();

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showFulfillmentModal, setShowFulfillmentModal] = useState(false);
  const [showRiderModal, setShowRiderModal] = useState(false);
  const [creditNotes, setCreditNotes] = useState('');
  const [fulfillmentDetails, setFulfillmentDetails] = useState({
    imei: '',
    serialNumber: '',
  });
  const [riderPhone, setRiderPhone] = useState('');
  const [savedRiders, setSavedRiders] = useState<string[]>([]);

  // Payment Recording State
  const [showPaymentOptionModal, setShowPaymentOptionModal] = useState(false);
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Receipt Preview State
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);
  const [receiptHtml, setReceiptHtml] = useState('');
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState(false);
  const [selectedOrderItem, setSelectedOrderItem] =
    useState<OrderItemSnapshot | null>(null);
  const [pendingShipmentMode, setPendingShipmentMode] =
    useState<ShipmentCompletionMode>('provider');

  const [successModal, setSuccessModal] = useState({
    visible: false,
    title: 'Success!',
    message: '',
    subMessage: '',
  });

  // Android hardware back button handler for modals
  // This ensures the back button closes the modal instead of navigating away
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const anyModalOpen =
      showStatusModal ||
      showCreditModal ||
      showFulfillmentModal ||
      showRiderModal ||
      showPaymentOptionModal ||
      showRecordPaymentModal ||
      selectedOrderItem !== null;

    if (!anyModalOpen) return;

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        // Close modals in priority order (most specific first)
        if (showRecordPaymentModal) {
          setShowRecordPaymentModal(false);
          return true; // Prevent default back behavior
        }
        if (selectedOrderItem) {
          setSelectedOrderItem(null);
          return true;
        }
        if (showPaymentOptionModal) {
          setShowPaymentOptionModal(false);
          return true;
        }
        if (showFulfillmentModal) {
          setShowFulfillmentModal(false);
          return true;
        }
        if (showRiderModal) {
          setShowRiderModal(false);
          return true;
        }
        if (showCreditModal) {
          setShowCreditModal(false);
          return true;
        }
        if (showStatusModal) {
          setShowStatusModal(false);
          return true;
        }
        return false; // Let default back behavior happen
      }
    );

    return () => backHandler.remove();
  }, [
    showStatusModal,
    showCreditModal,
    showFulfillmentModal,
    showRiderModal,
    showPaymentOptionModal,
    showRecordPaymentModal,
    selectedOrderItem,
  ]);

  // Formatting Helpers
  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: merchantCurrency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Currency input formatting helpers
  const formatCurrencyInput = (value: string): string => {
    const numericValue = value.replace(/[^0-9]/g, '');
    if (!numericValue) return '';
    const num = Number.parseInt(numericValue, 10);
    return `${currencySymbol}${num.toLocaleString('en-NG')}`;
  };

  const parseCurrencyInput = (formattedValue: string): string => {
    return formattedValue.replace(/[^0-9]/g, '');
  };

  const handlePaymentAmountChange = (text: string) => {
    const rawValue = parseCurrencyInput(text);
    setPaymentAmount(rawValue);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-NG', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  // Handle action query param from orders list navigation
  // This allows direct modal opening when user selects "Record Payment" or "Ship on Credit"
  useEffect(() => {
    if (!order || !actionParam) return;

    if (actionParam === 'record-payment') {
      setShowRecordPaymentModal(true);
      // Pre-fill with outstanding balance
      const balance =
        order.balance || Number(order.total) - Number(order.amount_paid || 0);
      if (balance > 0) {
        setPaymentAmount(String(Math.round(balance)));
      }
    } else if (actionParam === 'ship-on-credit') {
      setShowCreditModal(true);
    }
  }, [order, actionParam]);

  // Load saved riders on mount
  useEffect(() => {
    async function loadSavedRiders() {
      try {
        const saved = await AsyncStorage.getItem('saved_riders');
        // Use Zod schema validation for safe parsing of stored data
        setSavedRiders(parseSavedRiders(saved));
      } catch (error) {
        console.error('Failed to load saved riders', error);
        setSavedRiders([]);
      }
    }
    loadSavedRiders();
  }, []);

  // Show error screen for invalid route params (after all hooks)
  if (!validatedParams) {
    return (
      <InvalidRouteScreen
        title="Invalid Order"
        message="The order ID is invalid. Please check the link and try again."
      />
    );
  }

  const handleSaveRider = async (phone: string) => {
    if (!phone || savedRiders.includes(phone)) return;
    const newRiders = [...savedRiders, phone];
    setSavedRiders(newRiders);
    await AsyncStorage.setItem('saved_riders', JSON.stringify(newRiders));
  };

  const handleSendToRider = async () => {
    if (!riderPhone) {
      Alert.alert('Required', 'Please enter a rider phone number');
      return;
    }

    await handleSaveRider(riderPhone);

    const rawShipping = order?.shipping_address as ShippingAddress;
    const shippingAddress =
      typeof rawShipping === 'object' ? rawShipping : null;
    const deliveryAddress = extractOrderDeliveryAddress(rawShipping) || '';
    const deliveryCityState = [shippingAddress?.city, shippingAddress?.state]
      .filter((part): part is string => Boolean(part?.trim()))
      .join(' ');

    const itemsList = order?.items
      ?.map((item) => `- ${item.quantity}x ${item.name}`)
      .join('\n');

    const message = `
📦 *New Order Dispatch*
Order #${order?.order_number}

*Pickup:*
${merchant?.business_name || 'Store'}
${merchant?.business_address || ''}

*Deliver to:*
${order?.customer_name}
${deliveryAddress}
${deliveryCityState}
Phone: ${order?.customer_phone?.trim() || 'N/A'}

*Items:*
${itemsList}

*Payment Status:* ${order?.payment_status?.toUpperCase()}
*Total to Collect:* ${formatPrice(order?.balance || 0)}
`.trim();

    const url = `https://wa.me/${riderPhone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;

    Linking.openURL(url)
      .then(() => {
        Alert.alert(
          'Order Sent to Rider',
          'Have you handed over the items to the rider?',
          [
            { text: 'No, invalid dispatch', style: 'cancel' },
            {
              text: 'Yes, Mark Shipped',
              onPress: () => {
                setShowRiderModal(false);
                void beginShipmentCompletion('self_fulfillment');
              },
            },
          ]
        );
      })
      .catch(() => {
        Alert.alert('Error', 'Could not open WhatsApp');
      });
  };

  const handleSendRiderToCustomer = () => {
    if (!order?.customer_phone?.trim()) return;

    const message = `
🚚 *Order Update*
Your order #${order.order_number} is on the way!

Rider Contact: ${riderPhone || 'Dispatch Rider'}
Please keep your phone available.

Thank you for choosing ${merchant?.business_name || 'us'}!
`.trim();

    const url = `https://wa.me/${order.customer_phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url);
  };

  const handleRecordPayment = async () => {
    if (!order) {
      Alert.alert('Error', 'Order details are not available yet');
      return;
    }

    if (
      !paymentAmount ||
      Number.isNaN(Number(paymentAmount)) ||
      Number(paymentAmount) <= 0
    ) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (!paymentMethod) {
      Alert.alert('Error', 'Please select a payment method');
      return;
    }

    try {
      const result = await recordPaymentMutation.mutateAsync({
        orderId: order.id,
        amount: Number(paymentAmount),
        paymentMethod,
        notes: paymentNotes,
      });

      setShowRecordPaymentModal(false);
      setPaymentAmount('');
      setPaymentMethod('');
      setPaymentNotes('');

      if (result.new_balance > 0) {
        Alert.alert(
          'Payment Recorded',
          `Remaining Balance: ${formatPrice(result.new_balance)}. Ship remaining on credit?`,
          [
            { text: 'No', style: 'cancel' },
            {
              text: 'Yes, Ship on Credit',
              onPress: () => setShowCreditModal(true),
            },
          ]
        );
      } else {
        Alert.alert('Success', 'Payment recorded. Order is now fully paid.');
      }
    } catch (err: unknown) {
      Alert.alert(
        'Error',
        (err as Error).message || 'Failed to record payment'
      );
    }
  };

  const handleCall = () => {
    const phone = order?.customer_phone?.trim();
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  const handleEmail = () => {
    if (order?.customer_email)
      Linking.openURL(`mailto:${order.customer_email}`);
  };

  const handleWhatsApp = () => {
    const phone = order?.customer_phone?.trim();
    if (phone) {
      Linking.openURL(`https://wa.me/${phone.replace(/\D/g, '')}`);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Order ${order?.order_number} details for ${order?.customer_name}`,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const hasShippableGadgetItems = () =>
    order?.items?.some(
      (item) =>
        item.name?.toLowerCase().includes('phone') ||
        item.name?.toLowerCase().includes('laptop') ||
        item.name?.toLowerCase().includes('iphone') ||
        item.name?.toLowerCase().includes('samsung') ||
        item.name?.toLowerCase().includes('dell') ||
        item.name?.toLowerCase().includes('hp') ||
        item.name?.toLowerCase().includes('alienware') ||
        item.name?.toLowerCase().includes('gaming')
    ) ?? false;

  const sendShippedEmailNotification = async () => {
    if (!order) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        return;
      }

      fetch(`${BASE_URL}/api/orders/${order.id}/shipped`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({}),
      }).catch(() => {
        // Silently ignore email errors for now; shipment already succeeded.
      });
    } catch {
      // Ignore email errors - shipment already succeeded.
    }
  };

  const saveFulfillmentDetails = async () => {
    if (!order) return;

    const { error } = await supabase
      .from('orders')
      .update({
        fulfillment_details: fulfillmentDetails,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    if (error) {
      throw error;
    }
  };

  const markOrderShippedWithProvider = async () => {
    if (!order) return;

    await updateStatusMutation.mutateAsync({
      orderId: order.id,
      status: 'shipped',
    });
  };

  const markOrderSelfFulfilled = async () => {
    if (!order) return;

    const dispatchPhone = riderPhone.trim();
    if (!dispatchPhone) {
      throw new Error('Please enter a rider phone number');
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('Unauthorized');
    }

    const response = await fetch(`${BASE_URL}/api/shipping/self-fulfill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        orderId: order.id,
        dispatchPhone,
        carrierName: 'Dispatch Rider',
        dispatchNotes: `Self-fulfilled from mobile admin for order ${order.order_number}`,
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        payload &&
        typeof payload === 'object' &&
        'error' in payload &&
        typeof payload.error === 'string'
          ? payload.error
          : 'Failed to mark order as self-fulfilled';
      throw new Error(message);
    }
  };

  const finalizeShipmentCompletion = async (
    mode: ShipmentCompletionMode,
    saveDetails: boolean
  ) => {
    if (!order) return;

    if (saveDetails) {
      await saveFulfillmentDetails();
    }

    if (mode === 'self_fulfillment') {
      await markOrderSelfFulfilled();
    } else {
      await markOrderShippedWithProvider();
    }

    setShowFulfillmentModal(false);
    setShowStatusModal(false);
    setFulfillmentDetails({ imei: '', serialNumber: '' });
    setPendingShipmentMode('provider');

    await sendShippedEmailNotification();

    queryClient.invalidateQueries({ queryKey: ['order', order.id] });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['order-counts'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });

    Alert.alert(
      'Success',
      mode === 'self_fulfillment'
        ? 'Order marked as self-fulfilled with dispatch details'
        : 'Order marked as shipped with fulfillment details'
    );
  };

  const beginShipmentCompletion = async (mode: ShipmentCompletionMode) => {
    if (!order) return;

    setPendingShipmentMode(mode);
    setShowStatusModal(false);

    if (hasShippableGadgetItems() && !order.fulfillment_details?.imei) {
      setShowFulfillmentModal(true);
      return;
    }

    try {
      await finalizeShipmentCompletion(mode, false);
    } catch (err: unknown) {
      Alert.alert(
        'Error',
        (err as Error).message || 'Failed to mark order as shipped'
      );
    }
  };

  const handleStatusUpdate = async (newStatus: ShippingStatus) => {
    if (!order) return;

    if (
      newStatus === 'processing' &&
      order.payment_status !== 'paid' &&
      !order.is_credit_order
    ) {
      setShowStatusModal(false);
      setShowPaymentOptionModal(true);
      return;
    }

    if (newStatus === 'shipped' && order.shipping_status === 'processing') {
      await beginShipmentCompletion('provider');
      return;
    }

    try {
      await updateStatusMutation.mutateAsync({
        orderId: order.id,
        status: newStatus,
      });
      setShowStatusModal(false);

      // Send delivered notification email when status changes to 'delivered'
      if (newStatus === 'delivered') {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session?.access_token) {
            if (__DEV__) {
              console.log('UseOrder: Sending delivered email...');
            }
            // Fire and forget - don't block the UI
            fetch(`${BASE_URL}/api/orders/${order.id}/delivered`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
            })
              .then((res) => {
                if (__DEV__) {
                  if (!res.ok)
                    console.log('UseOrder: Delivered email failed', res.status);
                  else
                    console.log('UseOrder: Delivered email sent successfully');
                }
              })
              .catch((err) => {
                if (__DEV__) {
                  console.log('UseOrder: Delivered email fetch error', err);
                }
              });
          }
        } catch (e) {
          if (__DEV__) {
            console.log('UseOrder: Error in delivered block', e);
          }
        }
      }

      // Send cancellation notification email when status changes to 'cancelled'
      if (newStatus === 'cancelled') {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session?.access_token) {
            if (__DEV__) {
              console.log('UseOrder: Sending cancelled email...');
            }
            // Fire and forget - don't block the UI
            fetch(`${BASE_URL}/api/orders/${order.id}/cancelled`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ cancelled_by: 'merchant' }),
            })
              .then((res) => {
                if (__DEV__) {
                  if (!res.ok)
                    console.log('UseOrder: Cancelled email failed', res.status);
                  else
                    console.log('UseOrder: Cancelled email sent successfully');
                }
              })
              .catch((err) => {
                if (__DEV__) {
                  console.log('UseOrder: Cancelled email fetch error', err);
                }
              });
          }
        } catch (e) {
          if (__DEV__) {
            console.log('UseOrder: Error in cancelled block', e);
          }
        }
      }

      // Determine feedback message
      let subMessage = '';
      if (['shipped', 'delivered', 'cancelled'].includes(newStatus)) {
        subMessage = `The customer has been notified via email that their order has been ${newStatus}.`;
      }

      setSuccessModal({
        visible: true,
        title:
          newStatus === 'delivered' ? 'Order Delivered! 🎉' : 'Status Updated',
        message: `Order status updated to ${newStatus}`,
        subMessage,
      });
    } catch (err: unknown) {
      const error = err as Error;
      if (
        error.message?.includes('PAYMENT_REQUIRED') ||
        error.message?.includes('paid before processing')
      ) {
        Alert.alert(
          'Payment Required',
          'This order must be paid before processing. Would you like to ship on credit?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Ship on Credit', onPress: () => setShowCreditModal(true) },
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to update status');
      }
    }
  };

  const handleShipOnCredit = async () => {
    if (!order) return;
    try {
      await shipOnCreditMutation.mutateAsync({
        orderId: order.id,
        creditNotes,
      });
      setShowCreditModal(false);
      setCreditNotes('');
      Alert.alert(
        'Success',
        'Order shipped on credit. A virtual account has been created for payment.'
      );
    } catch (err: unknown) {
      Alert.alert(
        'Error',
        (err as Error).message || 'Failed to ship on credit'
      );
    }
  };

  const handleSendReminder = async () => {
    if (!order) return;
    try {
      await sendReminderMutation.mutateAsync({
        orderId: order.id,
      });
      Alert.alert(
        'Reminder Sent',
        `Payment reminder sent to ${order.customer_email}`
      );
    } catch (err: unknown) {
      Alert.alert('Error', (err as Error).message || 'Failed to send reminder');
    }
  };

  const handleSubmitFulfillment = async () => {
    if (!order) return;

    if (!fulfillmentDetails.imei.trim()) {
      Alert.alert('Required', 'Please enter the IMEI number');
      return;
    }

    try {
      await finalizeShipmentCompletion(pendingShipmentMode, true);
    } catch (err: unknown) {
      Alert.alert(
        'Error',
        (err as Error).message || 'Failed to save fulfillment details'
      );
    }
  };

  const handleSendReceipt = async () => {
    if (!order || !merchant || isGeneratingReceipt) return;
    setIsGeneratingReceipt(true);
    try {
      // Determine bank account for invoice:
      // Priority: order-specific VBA → staff terminal → merchant's main terminal
      let virtualAccount = order.virtual_account ?? null;

      if (order.payment_status !== 'paid' && !virtualAccount) {
        if (order.staff_terminal) {
          // Staff-created order: use the staff's virtual terminal bank account
          virtualAccount = order.staff_terminal;
        } else {
          // Generate a per-order DVA (Dedicated Virtual Account) via Paystack
          // This creates a unique bank account for this order so payments auto-confirm
          try {
            const {
              data: { session },
            } = await supabase.auth.getSession();
            if (session?.access_token) {
              const dvaRes = await fetch(
                `${BASE_URL}/api/orders/${order.id}/generate-dva`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                  },
                }
              );
              if (dvaRes.ok) {
                const dvaJson = await dvaRes.json();
                if (dvaJson.virtualAccount?.account_number) {
                  virtualAccount = {
                    account_number: dvaJson.virtualAccount.account_number,
                    bank_name: dvaJson.virtualAccount.bank_name || '',
                    account_name: dvaJson.virtualAccount.account_name || '',
                  };
                }
              }
            }
          } catch {
            // DVA generation failed — will try fallbacks below
          }

          // Fallback 2: Merchant's Paystack virtual terminal
          if (!virtualAccount) {
            try {
              const {
                data: { session },
              } = await supabase.auth.getSession();
              if (session?.access_token) {
                const vtRes = await fetch(
                  `${BASE_URL}/api/paystack/virtual-terminal`,
                  {
                    headers: {
                      Authorization: `Bearer ${session.access_token}`,
                    },
                  }
                );
                if (vtRes.ok) {
                  const vtJson = await vtRes.json();
                  const terminal = vtJson.terminals?.find(
                    (t: { active: boolean }) => t.active
                  );
                  if (terminal?.account_number) {
                    virtualAccount = {
                      account_number: terminal.account_number,
                      bank_name: terminal.bank || '',
                      account_name: terminal.account_name || '',
                    };
                  }
                }
              }
            } catch {
              // Virtual terminal also unavailable
            }
          }

          // Fallback 3: Merchant's own bank details — resolve name via Paystack
          if (
            !virtualAccount &&
            merchant.bank_account_number &&
            merchant.bank_code
          ) {
            let resolvedName = merchant.bank_account_name || '';
            const resolvedBankName =
              getBankNameFromCode(merchant.bank_code) || '';

            // Resolve account name from Paystack if we don't have it
            if (!resolvedName || resolvedName === merchant.business_name) {
              try {
                const {
                  data: { session: s },
                } = await supabase.auth.getSession();
                if (s?.access_token) {
                  const resolveRes = await fetch(
                    `${BASE_URL}/api/paystack/resolve`,
                    {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${s.access_token}`,
                      },
                      body: JSON.stringify({
                        accountNumber: merchant.bank_account_number,
                        bankCode: merchant.bank_code,
                      }),
                    }
                  );
                  if (resolveRes.ok) {
                    const resolveJson: { account_name?: string } =
                      await resolveRes.json();
                    if (resolveJson.account_name) {
                      resolvedName = resolveJson.account_name;
                    }
                  }
                }
              } catch {
                // Resolve failed — use what we have
              }
            }

            virtualAccount = {
              account_number: merchant.bank_account_number,
              bank_name: resolvedBankName,
              account_name: resolvedName || merchant.business_name,
            };
          }
        }
      }

      // Build typed receipt data
      const receiptOrder: ReceiptOrder = {
        order_number: order.order_number,
        created_at: order.created_at,
        currency: order.currency ?? 'NGN',
        total: Number(order.total) || 0,
        subtotal: Number(order.subtotal) || Number(order.total) || 0,
        shipping_fee: Number(order.shipping_fee) || 0,
        tax_amount: Number(order.tax_amount) || 0,
        discount_amount: Number(order.discount_amount) || 0,
        amount_paid: Number(order.amount_paid) || 0,
        balance: Number(order.balance) || 0,
        payment_status: order.payment_status,
        payment_method: order.payment_method ?? null,
        is_credit_order: order.is_credit_order ?? false,
        customer_name: order.customer_name,
        customer_email: order.customer_email,
        customer_phone: order.customer_phone ?? null,
        virtual_account: virtualAccount,
        items: (order.items ?? []).map(
          (item: {
            product_name?: string;
            name?: string;
            variant_name?: string;
            quantity: number;
            price: number;
          }) => ({
            product_name: item.product_name || item.name || 'Product',
            variant_name: item.variant_name,
            quantity: item.quantity,
            price: Number(item.price) || 0,
          })
        ),
      };

      // Fetch merchant's T&C page content (not in context RPC)
      let merchantPages: { terms?: string } | null = null;
      try {
        const { data: pagesData } = await supabase
          .from('merchants')
          .select('pages')
          .eq('id', merchant.id)
          .single();

        if (
          pagesData?.pages &&
          typeof pagesData.pages === 'object' &&
          'terms' in pagesData.pages
        ) {
          const terms = (pagesData.pages as { terms: string }).terms;
          if (terms) {
            merchantPages = { terms };
          }
        }
      } catch {
        // Pages fetch failed — receipt still works without T&C
      }

      // Convert remote logo URLs to inline data URIs or fetch SVG XML
      let logoDataUri: string | null = merchant.logo_url ?? null;
      let svgXml: string | undefined;

      if (logoDataUri?.startsWith('https://')) {
        const isSvg = logoDataUri.toLowerCase().includes('.svg');
        if (isSvg) {
          try {
            const response = await fetch(logoDataUri);
            if (response.ok) {
              svgXml = await response.text();
            }
          } catch (e) {
            console.warn('[OrderDetails] SVG fetch failed', e);
          }
        } else {
          try {
            const { File, Paths } = await import('expo-file-system');
            const dest = new File(
              Paths.cache,
              `receipt_logo_${Date.now()}.png`
            );
            const downloaded = await File.downloadFileAsync(logoDataUri, dest, {
              idempotent: true,
            });
            const base64 = await downloaded.base64();
            const mime = downloaded.type || 'image/png';
            logoDataUri = `data:${mime};base64,${base64}`;
          } catch {
            logoDataUri = null;
          }
        }
      }

      const receiptMerchant: ReceiptMerchant = {
        business_name: merchant.business_name,
        logo_url: logoDataUri,
        email: merchant.email,
        phone: merchant.phone ?? null,
        support_email: merchant.support_email ?? null,
        support_phone: merchant.support_phone ?? null,
        business_address: merchant.business_address ?? null,
        cac_rc_number: merchant.cac_rc_number ?? null,
        tax_identification_number: merchant.tax_identification_number ?? null,
        legal_entity_name: merchant.legal_entity_name ?? null,
        brand_colors: merchant.brand_colors ?? undefined,
        vat_registration_status: merchant.vat_registration_status ?? null,
        vat_rate: merchant.vat_rate ?? null,
        bank_code: merchant.bank_code ?? null,
        bank_account_number: merchant.bank_account_number ?? null,
        social_media: merchant.social_media ?? null,
        pages: merchantPages,
      };

      const html = generateReceiptHtml(receiptOrder, receiptMerchant, {
        svgXml,
      });
      setReceiptHtml(html);
      setShowReceiptPreview(true);
    } catch (_error) {
      Alert.alert('Error', 'Failed to generate receipt');
    } finally {
      setIsGeneratingReceipt(false);
    }
  };

  const handleShareReceiptPdf = async () => {
    if (!receiptHtml) return;
    try {
      if (!Print || !Sharing) {
        Alert.alert(
          'Error',
          'Export modules are not available on this platform.'
        );
        return;
      }
      const docType = order?.payment_status === 'paid' ? 'Receipt' : 'Invoice';
      const bizName = (merchant?.business_name || 'Baci').replace(
        /[^a-zA-Z0-9]/g,
        '-'
      );
      const custName = (order?.customer_name || 'Customer')
        .replace(/[^a-zA-Z0-9 ]/g, '')
        .trim()
        .replace(/\s+/g, '-');
      const dateStr = new Date()
        .toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
        .replace(/ /g, '-');
      const pdfFilename = `${bizName}_${docType}_${custName}_${dateStr}`;

      const { uri } = await Print.printToFileAsync({ html: receiptHtml });

      // Rename to a user-friendly filename
      const { File } = await import('expo-file-system');
      const printedFile = new File(uri);
      const destDir = uri.substring(0, uri.lastIndexOf('/'));
      const destFile = new File(`${destDir}/${pdfFilename}.pdf`);
      if (destFile.exists) destFile.delete();
      printedFile.move(destFile);

      await Sharing.shareAsync(destFile.uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
      });
    } catch (_error) {
      Alert.alert('Error', 'Failed to share receipt PDF');
    }
  };

  if (isLoading) {
    return (
      <View
        style={[styles.centerContainer, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !order) {
    return (
      <View
        style={[styles.centerContainer, { backgroundColor: colors.background }]}
      >
        <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
        <Text style={[styles.errorText, { color: colors.text }]}>
          Failed to load order
        </Text>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={{ color: colors.primary }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const shippingConfig =
    SHIPPING_STATUS_CONFIG[order.shipping_status as ShippingStatus] ||
    SHIPPING_STATUS_CONFIG.pending;
  const paymentConfig =
    PAYMENT_STATUS_CONFIG[order.payment_status as PaymentStatus] ||
    PAYMENT_STATUS_CONFIG.pending;
  const shippingColor = getStatusColor(shippingConfig.colorKey, colors);
  const paymentColor = getStatusColor(paymentConfig.colorKey, colors);

  const getSourceIcon = (source: string | null) => {
    const s = (source || '').toLowerCase().trim();
    if (s === 'instagram')
      return { name: 'logo-instagram', color: '#C13584', label: 'Instagram' };
    if (s === 'whatsapp')
      return { name: 'logo-whatsapp', color: '#25D366', label: 'WhatsApp' };
    if (s === 'facebook')
      return { name: 'logo-facebook', color: '#1877F2', label: 'Facebook' };
    if (s === 'tiktok')
      return { name: 'logo-tiktok', color: '#000000', label: 'TikTok' };
    if (s === 'mobile_app')
      return {
        name: 'phone-portrait-outline',
        color: colors.primary,
        label: 'Mobile App',
      };
    if (s === 'physical')
      return { name: 'storefront-outline', color: colors.gold, label: 'Store' };
    if (s === 'staff_entry')
      return {
        name: 'person-outline',
        color: colors.textSecondary,
        label: 'Staff Entry',
      };
    if (s === 'online_store' || s === 'website' || s === 'storefront')
      return {
        name: 'globe-outline',
        color: colors.textSecondary,
        label: 'Website',
      };
    return {
      name: 'pricetag-outline',
      color: colors.textSecondary,
      label: s.charAt(0).toUpperCase() + s.slice(1) || 'Order',
    };
  };
  const sourceInfo = getSourceIcon(order.source);

  const formatAddress = (
    addr: {
      address: string;
      city: string;
      state: string;
    } | null
  ) => {
    if (!addr) return 'No shipping address provided';
    if (typeof addr === 'string') return addr;
    if (typeof addr === 'object') {
      return [addr.address, addr.city, addr.state]
        .filter((part): part is string => Boolean(part))
        .join(', ');
    }
    return 'Invalid address format';
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: order.order_number,
          headerBackTitle: 'Back',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerRight: () => (
            <Pressable onPress={handleShare} style={styles.headerButton}>
              <Ionicons name="share-outline" size={24} color={colors.primary} />
            </Pressable>
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status Timeline */}
        <View
          style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}
        >
          <View style={styles.statusHeader}>
            <View>
              <Text style={[styles.orderDate, { color: colors.textSecondary }]}>
                Placed on {formatDate(order.created_at)}
              </Text>
              <View style={styles.sourceRow}>
                <Ionicons
                  name={sourceInfo.name as keyof typeof Ionicons.glyphMap}
                  size={14}
                  color={sourceInfo.color}
                />
                <Text
                  style={[styles.sourceText, { color: colors.textSecondary }]}
                >
                  {order.source === 'staff_entry' && order.recorded_by_name
                    ? `Recorded by ${order.recorded_by_name}`
                    : `via ${sourceInfo.label}`}
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.statusBadgeBig,
                { backgroundColor: `${shippingColor}15` },
              ]}
            >
              <Ionicons
                name={
                  shippingConfig.icon as React.ComponentProps<
                    typeof Ionicons
                  >['name']
                }
                size={14}
                color={shippingColor}
              />
              <Text style={[styles.statusTextBig, { color: shippingColor }]}>
                {shippingConfig.label}
              </Text>
            </View>
          </View>

          <View style={styles.progressContainer}>
            {/* 4-Step Order Journey + Return/Cancel */}
            {(() => {
              const baseSteps = [
                'pending',
                'processing',
                'shipped',
                'delivered',
              ];
              const currentStatus =
                order.shipping_status === 'fulfilled'
                  ? 'pending'
                  : order.shipping_status;

              const steps = [...baseSteps];
              if (currentStatus === 'returned') steps.push('returned');
              if (currentStatus === 'cancelled') steps.push('cancelled');

              return steps.map((step, index) => {
                const currentStepIndex = steps.indexOf(currentStatus);
                const isActive = index <= currentStepIndex;
                const isCurrent = index === currentStepIndex;
                const isLast = index === steps.length - 1;
                const config =
                  SHIPPING_STATUS_CONFIG[step as ShippingStatus] ??
                  SHIPPING_STATUS_CONFIG.pending;
                const stepColor = getStatusColor(step, colors);

                return (
                  <React.Fragment key={step}>
                    <View style={styles.progressStep}>
                      <View
                        style={[
                          styles.progressDot,
                          {
                            backgroundColor: isActive
                              ? stepColor
                              : colors.inputBg,
                            borderColor: isActive ? stepColor : colors.border,
                          },
                        ]}
                      >
                        <Ionicons
                          name={
                            config.icon as React.ComponentProps<
                              typeof Ionicons
                            >['name']
                          }
                          size={12}
                          color={isActive ? '#FFF' : colors.textMuted}
                        />
                      </View>
                      <Text
                        style={[
                          styles.progressLabel,
                          {
                            color: isCurrent ? colors.text : colors.textMuted,
                            fontWeight: isCurrent ? '700' : '600',
                          },
                        ]}
                      >
                        {config.label}
                      </Text>
                    </View>
                    {!isLast && (
                      <View
                        style={[
                          styles.progressLine,
                          {
                            backgroundColor:
                              index < currentStepIndex
                                ? stepColor
                                : colors.border,
                          },
                        ]}
                      />
                    )}
                  </React.Fragment>
                );
              });
            })()}
          </View>
          <Text style={[styles.statusNote, { color: colors.textMuted }]}>
            Latest update: {formatDate(order.updated_at)}
          </Text>
        </View>

        {/* Customer Card */}
        <View
          style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Customer
            </Text>
          </View>

          <View style={styles.customerRow}>
            <View
              style={[
                styles.avatarPlaceholder,
                { backgroundColor: `${colors.primary}15` },
              ]}
            >
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {order.customer_name?.[0]?.toUpperCase()}
              </Text>
            </View>
            <View style={styles.customerInfo}>
              <Text style={[styles.customerName, { color: colors.text }]}>
                {order.customer_name}
              </Text>
              <Text
                style={[styles.customerDetail, { color: colors.textSecondary }]}
              >
                {order.customer_email}
              </Text>
              <Text
                style={[styles.customerDetail, { color: colors.textSecondary }]}
              >
                {order.customer_phone}
              </Text>
            </View>
            <Pressable
              style={[
                styles.receiptBtn,
                {
                  backgroundColor: isGeneratingReceipt
                    ? colors.textMuted
                    : colors.primary,
                },
              ]}
              onPress={handleSendReceipt}
              disabled={isGeneratingReceipt}
            >
              {isGeneratingReceipt ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name="document-text-outline" size={18} color="#FFF" />
              )}
              <Text style={styles.receiptBtnText}>
                {isGeneratingReceipt
                  ? 'Generating...'
                  : order.payment_status === 'paid'
                    ? 'Receipt'
                    : 'Invoice'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.actionButtons}>
            <Pressable
              style={[
                styles.actionBtn,
                { backgroundColor: colors.backgroundLight },
              ]}
              onPress={handleCall}
            >
              <Ionicons name="call" size={20} color={colors.primary} />
              <Text style={[styles.actionBtnText, { color: colors.primary }]}>
                Call
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.actionBtn,
                { backgroundColor: colors.backgroundLight },
              ]}
              onPress={handleWhatsApp}
            >
              <Ionicons
                name="logo-whatsapp"
                size={20}
                color={BRAND_COLORS.whatsapp}
              />
              <Text
                style={[styles.actionBtnText, { color: BRAND_COLORS.whatsapp }]}
              >
                WhatsApp
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.actionBtn,
                { backgroundColor: colors.backgroundLight },
              ]}
              onPress={handleEmail}
            >
              <Ionicons name="mail" size={20} color={colors.textSecondary} />
              <Text
                style={[styles.actionBtnText, { color: colors.textSecondary }]}
              >
                Email
              </Text>
            </Pressable>
          </View>

          {/* Rider Actions - Full Width */}
          {order.shipping_status === 'processing' && (
            <Pressable
              style={[
                styles.actionBtn,
                {
                  backgroundColor: `${colors.warning}20`,
                  marginTop: 12,
                  width: '100%',
                },
              ]}
              onPress={() => setShowRiderModal(true)}
            >
              <Ionicons name="bicycle" size={20} color={colors.warning} />
              <Text style={[styles.actionBtnText, { color: colors.warning }]}>
                Dispatch Rider
              </Text>
            </Pressable>
          )}

          {order.shipping_status === 'shipped' && (
            <Pressable
              style={[
                styles.actionBtn,
                {
                  backgroundColor: `${colors.success}20`,
                  marginTop: 12,
                  width: '100%',
                },
              ]}
              onPress={handleSendRiderToCustomer}
            >
              <Ionicons name="share-social" size={20} color={colors.success} />
              <Text style={[styles.actionBtnText, { color: colors.success }]}>
                Share Rider Info
              </Text>
            </Pressable>
          )}
        </View>

        {/* Order Items */}
        <View
          style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Items ({order.items?.length || 0})
            </Text>
          </View>
          {order.items?.map((item, index: number) => (
            <Pressable
              key={item.id}
              style={[
                styles.itemRow,
                index !== (order.items?.length || 0) - 1 && {
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                },
              ]}
              onPress={() => setSelectedOrderItem(item)}
            >
              <View
                style={[
                  styles.itemImagePlaceholder,
                  { backgroundColor: colors.backgroundLight },
                ]}
              >
                {item.image_url ? (
                  <SafeImage
                    source={{ uri: item.image_url }}
                    style={styles.itemImage}
                  />
                ) : (
                  <Ionicons
                    name="image-outline"
                    size={24}
                    color={colors.textMuted}
                  />
                )}
              </View>
              <View style={styles.itemDetails}>
                <Text
                  style={[styles.itemName, { color: colors.text }]}
                  numberOfLines={2}
                >
                  {item.name}
                </Text>
                {item.variant_name ? (
                  <Text
                    style={[
                      styles.itemVariant,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {item.variant_name}
                  </Text>
                ) : null}
                <Text style={[styles.itemRef, { color: colors.textMuted }]}>
                  SKU: {item.product_id?.slice(0, 8)}...
                </Text>
                <View style={styles.itemPriceRow}>
                  <Text
                    style={[styles.itemQty, { color: colors.textSecondary }]}
                  >
                    x{item.quantity}
                  </Text>
                  <Text style={[styles.itemPrice, { color: colors.text }]}>
                    {formatPrice(item.price)}
                  </Text>
                </View>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.textMuted}
              />
            </Pressable>
          ))}
        </View>

        {/* Order Summary */}
        <View
          style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Payment Summary
            </Text>
          </View>

          {order.payment_status !== 'paid' && (
            <>
              <View style={styles.paymentActionsRow}>
                <Pressable
                  style={[
                    styles.paymentActionBtn,
                    { borderColor: colors.success },
                  ]}
                  onPress={() => {
                    const balance =
                      order.balance ||
                      Number(order.total) - Number(order.amount_paid || 0);
                    setPaymentAmount(String(Math.round(balance)));
                    setShowRecordPaymentModal(true);
                  }}
                >
                  <Ionicons
                    name="card-outline"
                    size={18}
                    color={colors.success}
                  />
                  <Text
                    style={[
                      styles.paymentActionBtnText,
                      { color: colors.success },
                    ]}
                  >
                    Record Payment
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.paymentActionBtn,
                    { borderColor: colors.primary },
                  ]}
                  onPress={handleSendReminder}
                >
                  <Ionicons
                    name="notifications-outline"
                    size={18}
                    color={colors.primary}
                  />
                  <Text
                    style={[
                      styles.paymentActionBtnText,
                      { color: colors.primary },
                    ]}
                  >
                    Request Payment
                  </Text>
                </Pressable>
              </View>
              <View
                style={[
                  styles.divider,
                  { backgroundColor: colors.border, marginVertical: 16 },
                ]}
              />
            </>
          )}

          <View style={styles.summaryRow}>
            <Text
              style={[styles.summaryLabel, { color: colors.textSecondary }]}
            >
              Subtotal
            </Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {formatPrice(order.subtotal || order.total)}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text
              style={[styles.summaryLabel, { color: colors.textSecondary }]}
            >
              Shipping
            </Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {order.shipping_fee ? formatPrice(order.shipping_fee) : 'Free'}
            </Text>
          </View>

          {order.discount_amount > 0 && (
            <View style={styles.summaryRow}>
              <Text
                style={[styles.summaryLabel, { color: colors.textSecondary }]}
              >
                Discount
              </Text>
              <Text style={[styles.summaryValue, { color: colors.error }]}>
                -{formatPrice(order.discount_amount)}
              </Text>
            </View>
          )}

          <View
            style={[
              styles.divider,
              { backgroundColor: colors.border, marginVertical: 12 },
            ]}
          />

          <View style={styles.summaryRow}>
            <Text style={[styles.totalLabel, { color: colors.text }]}>
              Total Order
            </Text>
            <Text style={[styles.totalValueMain, { color: colors.text }]}>
              {formatPrice(order.total)}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text
              style={[styles.summaryLabel, { color: colors.textSecondary }]}
            >
              Payment Method
            </Text>
            <Text
              style={[
                styles.summaryValue,
                { color: colors.text, textTransform: 'capitalize' },
              ]}
            >
              {order.payment_method?.replace(/_/g, ' ') || 'N/A'}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text
              style={[styles.summaryLabel, { color: colors.textSecondary }]}
            >
              Payment Status
            </Text>
            <View
              style={[
                styles.statusBadgeSmall,
                { backgroundColor: `${paymentColor}15` },
              ]}
            >
              <Text style={[styles.statusTextSmall, { color: paymentColor }]}>
                {paymentConfig.label}
              </Text>
            </View>
          </View>

          <View style={styles.summaryRow}>
            <Text
              style={[styles.summaryLabel, { color: colors.textSecondary }]}
            >
              Amount Paid
            </Text>
            <Text
              style={[
                styles.summaryValue,
                {
                  color:
                    order.amount_paid > 0
                      ? colors.success
                      : colors.textSecondary,
                  fontWeight: '700',
                },
              ]}
            >
              {formatPrice(order.amount_paid || 0)}
            </Text>
          </View>

          {order.balance > 0 && (
            <View style={styles.summaryRow}>
              <Text
                style={[
                  styles.totalLabel,
                  { color: colors.text, fontSize: 14 },
                ]}
              >
                Balance Due
              </Text>
              <Text
                style={[
                  styles.totalValueMain,
                  { color: colors.error, fontSize: 18 },
                ]}
              >
                {formatPrice(order.balance)}
              </Text>
            </View>
          )}
        </View>

        {/* Shipping Card */}
        <View
          style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}
        >
          <View style={styles.cardHeader}>
            <Ionicons name="location-outline" size={18} color={colors.text} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Shipping Address
            </Text>
          </View>
          <Text style={[styles.addressText, { color: colors.textSecondary }]}>
            {formatAddress(order.shipping_address)}
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Footer */}
      <View
        style={[
          styles.floatingFooter,
          { backgroundColor: colors.card, borderTopColor: colors.border },
          shadows.lg,
        ]}
      >
        <View style={styles.footerContent}>
          <View>
            <Text style={[styles.footerLabel, { color: colors.textSecondary }]}>
              Current Status
            </Text>
            <Text style={[styles.footerStatus, { color: shippingColor }]}>
              {shippingConfig.label}
            </Text>
          </View>
          <Pressable
            style={[styles.updateButton, { backgroundColor: colors.primary }]}
            onPress={() => setShowStatusModal(true)}
          >
            <Text style={styles.updateButtonText}>Update Status</Text>
            <Ionicons name="chevron-up" size={16} color="#FFF" />
          </Pressable>
        </View>
      </View>

      {/* Status Modal */}
      {showStatusModal && (
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowStatusModal(false)}
          />
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Update Order Status
            </Text>
            {Object.entries(SHIPPING_STATUS_CONFIG).map(([key, config]) => {
              const currentStatus =
                order.shipping_status === 'fulfilled'
                  ? 'pending'
                  : order.shipping_status;
              const isAllowed = isStatusActionAllowed(
                order.shipping_status,
                key
              );
              const isCurrent = currentStatus === key;
              return (
                <Pressable
                  key={key}
                  disabled={!isAllowed}
                  style={[
                    styles.modalOption,
                    {
                      backgroundColor: isCurrent
                        ? `${colors.primary}10`
                        : 'transparent',
                      opacity: isAllowed ? 1 : 0.4,
                    },
                  ]}
                  onPress={() => handleStatusUpdate(key as ShippingStatus)}
                >
                  <View
                    style={[
                      styles.modalDot,
                      {
                        backgroundColor: getStatusColor(
                          config.colorKey,
                          colors
                        ),
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.modalOptionText,
                      {
                        color: isCurrent ? colors.primary : colors.text,
                        fontWeight: isCurrent ? '700' : '400',
                      },
                    ]}
                  >
                    {(() => {
                      if (isCurrent) return config.label;

                      // Find the label in SHIPPING_STATUS_ACTIONS by searching all possible transitions
                      let actionLabel = config.label;
                      for (const actions of Object.values(
                        SHIPPING_STATUS_ACTIONS
                      )) {
                        const foundAction = actions.find(
                          (a) => a.nextStatus === key
                        );
                        if (foundAction) {
                          actionLabel = foundAction.label;
                          break;
                        }
                      }
                      return actionLabel;
                    })()}
                  </Text>
                  {isCurrent && (
                    <Ionicons
                      name="checkmark"
                      size={20}
                      color={colors.primary}
                    />
                  )}
                  {!isAllowed && !isCurrent && (
                    <Ionicons
                      name="lock-closed-outline"
                      size={16}
                      color={colors.textMuted}
                    />
                  )}
                </Pressable>
              );
            })}
            <Pressable
              style={styles.closeButton}
              onPress={() => setShowStatusModal(false)}
            >
              <Text style={{ color: colors.textSecondary }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Credit Modal */}
      {showCreditModal && (
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowCreditModal(false)}
          />
          <KeyboardAwareModalContainer
            align="end"
            contentContainerStyle={styles.modalKeyboardContent}
          >
            <View
              style={[styles.modalContent, { backgroundColor: colors.card }]}
            >
              <Ionicons
                name="alert-circle"
                size={48}
                color={colors.warning}
                style={{ alignSelf: 'center', marginBottom: 16 }}
              />
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Ship on Credit?
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  textAlign: 'center',
                  marginBottom: 20,
                }}
              >
                This order has not been paid yet. Confirm to ship on credit and
                create a virtual account for payment.
              </Text>
              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>
                  Add a note (optional)
                </Text>
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: RADIUS.md,
                    padding: 12,
                  }}
                >
                  <TextInput
                    multiline
                    placeholder="e.g., Trusted customer, will pay on delivery"
                    placeholderTextColor={colors.textSecondary}
                    style={{ color: colors.text, minHeight: 60 }}
                    value={creditNotes}
                    onChangeText={setCreditNotes}
                  />
                </View>
              </View>
              <Pressable
                style={[
                  styles.updateButton,
                  { backgroundColor: colors.warning, marginBottom: 12 },
                ]}
                onPress={handleShipOnCredit}
                disabled={shipOnCreditMutation.isPending}
              >
                {shipOnCreditMutation.isPending ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                    <Text style={styles.updateButtonText}>
                      Confirm Ship on Credit
                    </Text>
                  </>
                )}
              </Pressable>
              <Pressable
                style={styles.closeButton}
                onPress={() => setShowCreditModal(false)}
              >
                <Text style={{ color: colors.textSecondary }}>Cancel</Text>
              </Pressable>
            </View>
          </KeyboardAwareModalContainer>
        </View>
      )}

      {/* Fulfillment Modal */}
      {showFulfillmentModal && (
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowFulfillmentModal(false)}
          />
          <KeyboardAwareModalContainer
            align="end"
            contentContainerStyle={styles.modalKeyboardContent}
          >
            <View
              style={[styles.modalContent, { backgroundColor: colors.card }]}
            >
              <Ionicons
                name="barcode-outline"
                size={48}
                color={colors.primary}
                style={{ alignSelf: 'center', marginBottom: 16 }}
              />
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Fulfillment Details Required
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  textAlign: 'center',
                  marginBottom: 20,
                }}
              >
                Enter the device IMEI/serial number before marking as shipped.
              </Text>
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>
                  IMEI Number *
                </Text>
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: RADIUS.md,
                    padding: 12,
                  }}
                >
                  <TextInput
                    keyboardType="numeric"
                    maxLength={15}
                    placeholder="e.g., 353456789012345"
                    placeholderTextColor={colors.textSecondary}
                    style={{ color: colors.text }}
                    value={fulfillmentDetails.imei}
                    onChangeText={(text) =>
                      setFulfillmentDetails((prev) => ({ ...prev, imei: text }))
                    }
                  />
                </View>
              </View>
              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>
                  Serial Number (optional)
                </Text>
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: RADIUS.md,
                    padding: 12,
                  }}
                >
                  <TextInput
                    placeholder="e.g., ABC123XYZ"
                    placeholderTextColor={colors.textSecondary}
                    style={{ color: colors.text }}
                    value={fulfillmentDetails.serialNumber}
                    onChangeText={(text) =>
                      setFulfillmentDetails((prev) => ({
                        ...prev,
                        serialNumber: text,
                      }))
                    }
                  />
                </View>
              </View>
              <Pressable
                style={[
                  styles.updateButton,
                  { backgroundColor: colors.success, marginBottom: 12 },
                ]}
                onPress={handleSubmitFulfillment}
              >
                <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                <Text style={styles.updateButtonText}>
                  Confirm & Mark Shipped
                </Text>
              </Pressable>
              <Pressable
                style={styles.closeButton}
                onPress={() => setShowFulfillmentModal(false)}
              >
                <Text style={{ color: colors.textSecondary }}>Cancel</Text>
              </Pressable>
            </View>
          </KeyboardAwareModalContainer>
        </View>
      )}

      {/* Rider Modal */}
      {showRiderModal && (
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowRiderModal(false)}
          />
          <KeyboardAwareModalContainer
            align="end"
            contentContainerStyle={styles.modalKeyboardContent}
          >
            <View
              style={[styles.modalContent, { backgroundColor: colors.card }]}
            >
              <Ionicons
                name="bicycle-outline"
                size={48}
                color={colors.primary}
                style={{ alignSelf: 'center', marginBottom: 16 }}
              />
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Dispatch Rider
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  textAlign: 'center',
                  marginBottom: 20,
                }}
              >
                Enter rider's WhatsApp number to send order details.
              </Text>
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>
                  Rider Phone Number
                </Text>
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: RADIUS.md,
                    padding: 12,
                  }}
                >
                  <TextInput
                    placeholder="e.g., +23480..."
                    placeholderTextColor={colors.textSecondary}
                    value={riderPhone}
                    onChangeText={setRiderPhone}
                    keyboardType="phone-pad"
                    style={{ color: colors.text }}
                  />
                </View>
              </View>
              {savedRiders.length > 0 && (
                <View style={{ marginBottom: 20 }}>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      marginBottom: 8,
                      fontSize: 12,
                    }}
                  >
                    Saved Riders
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8 }}
                  >
                    {savedRiders.map((phone) => (
                      <Pressable
                        key={phone}
                        style={{
                          backgroundColor: colors.backgroundLight,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: RADIUS.full,
                          borderWidth: 1,
                          borderColor:
                            riderPhone === phone
                              ? colors.primary
                              : 'transparent',
                        }}
                        onPress={() => setRiderPhone(phone)}
                      >
                        <Text style={{ color: colors.text, fontSize: 12 }}>
                          {phone}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
              <Pressable
                style={[
                  styles.updateButton,
                  { backgroundColor: colors.success, marginBottom: 12 },
                ]}
                onPress={handleSendToRider}
              >
                <Ionicons name="logo-whatsapp" size={20} color="#FFF" />
                <Text style={styles.updateButtonText}>Send & Dispatch</Text>
              </Pressable>
              <Pressable
                style={styles.closeButton}
                onPress={() => setShowRiderModal(false)}
              >
                <Text style={{ color: colors.textSecondary }}>Cancel</Text>
              </Pressable>
            </View>
          </KeyboardAwareModalContainer>
        </View>
      )}

      {/* Payment Option Modal */}
      {showPaymentOptionModal && (
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowPaymentOptionModal(false)}
          />
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Ionicons
              name="card-outline"
              size={48}
              color={colors.primary}
              style={{ alignSelf: 'center', marginBottom: 16 }}
            />
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Processing Unpaid Order
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                textAlign: 'center',
                marginBottom: 24,
              }}
            >
              This order has an outstanding balance of{' '}
              {formatPrice(order.balance || order.total)}.
            </Text>
            <Pressable
              style={[
                styles.updateButton,
                { backgroundColor: colors.primary, marginBottom: 12 },
              ]}
              onPress={() => {
                setShowPaymentOptionModal(false);
                setPaymentAmount(
                  String(Math.round(order.balance || order.total))
                );
                setShowRecordPaymentModal(true);
              }}
            >
              <Ionicons name="add-circle-outline" size={20} color="#FFF" />
              <Text style={styles.updateButtonText}>Record Manual Payment</Text>
            </Pressable>
            <Pressable
              style={[
                styles.updateButton,
                {
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.primary,
                  marginBottom: 12,
                },
              ]}
              onPress={() => {
                setShowPaymentOptionModal(false);
                setShowCreditModal(true);
              }}
            >
              <Ionicons name="timer-outline" size={20} color={colors.primary} />
              <Text
                style={[styles.updateButtonText, { color: colors.primary }]}
              >
                Ship on Credit
              </Text>
            </Pressable>
            <Pressable
              style={styles.closeButton}
              onPress={() => setShowPaymentOptionModal(false)}
            >
              <Text style={{ color: colors.textSecondary }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Record Payment Modal */}
      {showRecordPaymentModal && (
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowRecordPaymentModal(false)}
          />
          <KeyboardAwareModalContainer
            align="end"
            contentContainerStyle={styles.modalKeyboardContent}
          >
            <View
              style={[styles.modalContent, { backgroundColor: colors.card }]}
            >
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Record Payment
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  textAlign: 'center',
                  marginBottom: 20,
                }}
              >
                Enter payment details manually.
              </Text>
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>
                  Amount Paid
                </Text>
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: RADIUS.md,
                    padding: 12,
                  }}
                >
                  <TextInput
                    placeholder={`${currencySymbol}0`}
                    placeholderTextColor={colors.textSecondary}
                    value={
                      paymentAmount ? formatCurrencyInput(paymentAmount) : ''
                    }
                    onChangeText={handlePaymentAmountChange}
                    keyboardType="numeric"
                    style={{
                      color: colors.text,
                      fontSize: 18,
                      fontWeight: '600',
                    }}
                  />
                </View>
              </View>
              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>
                  Payment Method
                </Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {['transfer', 'pos', 'cash'].map((method) => (
                    <Pressable
                      key={method}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: RADIUS.md,
                        backgroundColor:
                          paymentMethod === method
                            ? colors.primary
                            : colors.backgroundLight,
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor:
                          paymentMethod === method
                            ? colors.primary
                            : colors.border,
                      }}
                      onPress={() => setPaymentMethod(method)}
                    >
                      <Text
                        style={{
                          color:
                            paymentMethod === method ? '#FFF' : colors.text,
                          fontWeight: '500',
                          textTransform: 'capitalize',
                        }}
                      >
                        {method === 'pos' ? 'POS' : method}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={{ marginBottom: 24 }}>
                <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>
                  Notes (Optional)
                </Text>
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: RADIUS.md,
                    padding: 12,
                  }}
                >
                  <TextInput
                    placeholder="E.g., Received by John"
                    placeholderTextColor={colors.textSecondary}
                    value={paymentNotes}
                    onChangeText={setPaymentNotes}
                    style={{ color: colors.text }}
                  />
                </View>
              </View>
              <Pressable
                style={[
                  styles.updateButton,
                  {
                    backgroundColor: colors.success,
                    marginBottom: 12,
                    opacity: !paymentMethod || !paymentAmount ? 0.5 : 1,
                  },
                ]}
                onPress={handleRecordPayment}
                disabled={
                  recordPaymentMutation.isPending ||
                  !paymentMethod ||
                  !paymentAmount
                }
              >
                {recordPaymentMutation.isPending ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                    <Text style={styles.updateButtonText}>Confirm Payment</Text>
                  </>
                )}
              </Pressable>
              <Pressable
                style={styles.closeButton}
                onPress={() => setShowRecordPaymentModal(false)}
              >
                <Text style={{ color: colors.textSecondary }}>Cancel</Text>
              </Pressable>
            </View>
          </KeyboardAwareModalContainer>
        </View>
      )}

      <SuccessModal
        visible={successModal.visible}
        title={successModal.title}
        message={successModal.message}
        subMessage={successModal.subMessage}
        onClose={() => setSuccessModal((prev) => ({ ...prev, visible: false }))}
      />

      <ReceiptPreviewModal
        visible={showReceiptPreview}
        html={receiptHtml}
        onClose={() => setShowReceiptPreview(false)}
        onShare={handleShareReceiptPdf}
        isPaid={order.payment_status === 'paid'}
      />

      <OrderItemDetailModal
        visible={selectedOrderItem !== null}
        item={selectedOrderItem}
        formattedUnitPrice={
          selectedOrderItem ? formatPrice(selectedOrderItem.price) : ''
        }
        formattedLineTotal={
          selectedOrderItem
            ? formatPrice(selectedOrderItem.price * selectedOrderItem.quantity)
            : ''
        }
        onClose={() => setSelectedOrderItem(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: SPACING.lg, gap: SPACING.lg },
  headerButton: { padding: 8 },
  errorText: { fontSize: 16, marginTop: 12, marginBottom: 24, opacity: 0.7 },
  backButton: { padding: 12 },

  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.xs,
  },

  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  orderDate: { fontSize: TYPOGRAPHY.size.xs, marginBottom: 4 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sourceText: { fontSize: TYPOGRAPHY.size.xs, fontWeight: '500' },
  statusBadgeBig: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  statusTextBig: { fontSize: TYPOGRAPHY.size.sm, fontWeight: '700' },
  statusNote: {
    fontSize: TYPOGRAPHY.size.xs,
    marginTop: 12,
    textAlign: 'center',
  },

  progressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  progressStep: {
    width: 72,
    alignItems: 'center',
    gap: 8,
  },
  progressDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    borderWidth: 1,
  },
  progressLabel: {
    fontSize: TYPOGRAPHY.size.xs,
    textAlign: 'center',
    lineHeight: 16,
  },
  progressLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 4,
    marginTop: 16,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  cardTitle: { fontSize: TYPOGRAPHY.size.md, fontWeight: '700' },

  customerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: { fontSize: 20, fontWeight: '700' },
  customerInfo: { flex: 1 },
  customerName: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: '700',
    marginBottom: 4,
  },
  customerDetail: { fontSize: TYPOGRAPHY.size.sm, marginBottom: 2 },

  actionButtons: { flexDirection: 'row', gap: 12 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: RADIUS.md,
    gap: 6,
  },
  actionBtnText: { fontSize: TYPOGRAPHY.size.xs, fontWeight: '600' },

  receiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
  },
  receiptBtnText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: '600',
    color: '#FFF',
  },

  itemRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  itemImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  itemImage: { width: '100%', height: '100%' },
  itemDetails: { flex: 1, justifyContent: 'center' },
  itemName: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemVariant: {
    fontSize: TYPOGRAPHY.size.xs,
    marginBottom: 4,
  },
  itemRef: { fontSize: TYPOGRAPHY.size.xs, marginBottom: 6 },
  itemPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemQty: { fontSize: TYPOGRAPHY.size.sm },
  itemPrice: { fontSize: TYPOGRAPHY.size.sm, fontWeight: '700' },
  statusBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusTextSmall: { fontSize: 11, fontWeight: '700' },
  addressText: { fontSize: 13, lineHeight: 18, marginTop: 8 },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 14, fontWeight: '600' },
  divider: { height: 1, marginVertical: 12 },
  totalLabel: { fontSize: 16, fontWeight: '700' },
  totalValueMain: { fontSize: 20, fontWeight: '800' },

  paymentActionsRow: { flexDirection: 'row', gap: 12 },
  paymentActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: 8,
  },
  paymentActionBtnText: { fontSize: 13, fontWeight: '700' },

  floatingFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 34,
    borderTopWidth: 1,
  },
  footerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLabel: { fontSize: 12 },
  footerStatus: { fontSize: 14, fontWeight: '700' },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: RADIUS.full,
    gap: 8,
  },
  updateButtonText: { color: '#FFF', fontWeight: '600' },

  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalKeyboardContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  modalDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  modalOptionText: { fontSize: 16, flex: 1 },
  closeButton: { alignItems: 'center', padding: 16, marginTop: 8 },
});
