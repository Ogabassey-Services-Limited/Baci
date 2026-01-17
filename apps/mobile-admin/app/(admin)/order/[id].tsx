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
import * as Print from 'expo-print';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SuccessModal } from '@/components/ui/SuccessModal';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
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
import { supabase } from '@/lib/supabase';

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

const generateReceiptHtml = (order: {
  total: number;
  created_at: string;
  payment_status: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  payment_method: string | null;
  items: Array<{
    product_name: string;
    quantity: number;
    price: number;
  }>;
}) => {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);
  const total = formatCurrency(order.total);
  const date = new Date(order.created_at).toLocaleDateString('en-NG', {
    dateStyle: 'medium',
  });
  const time = new Date(order.created_at).toLocaleTimeString('en-NG', {
    timeStyle: 'short',
  });
  const isPaid = order.payment_status === 'paid';
  const documentTitle = isPaid ? 'Receipt' : 'Invoice';
  const watermarkColor = isPaid
    ? 'rgba(34, 197, 94, 0.08)'
    : 'rgba(239, 68, 68, 0.08)';
  const watermarkBorderColor = isPaid
    ? 'rgba(34, 197, 94, 0.15)'
    : 'rgba(239, 68, 68, 0.15)';
  const watermarkText = isPaid ? 'PAID' : 'UNPAID';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background: #f8fafc;
            padding: 24px;
            color: #1f2937;
          }
          .receipt-container {
            background: white;
            border-radius: 16px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            border: 1px solid #e5e7eb;
            overflow: hidden;
            position: relative;
          }
          .top-stripe {
            height: 6px;
            background: linear-gradient(90deg, #dc2626, #ef4444);
          }
          .watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-30deg);
            font-size: 64px;
            font-weight: 900;
            color: ${watermarkColor};
            border: 5px dashed ${watermarkBorderColor};
            border-radius: 12px;
            padding: 8px 24px;
            pointer-events: none;
            white-space: nowrap;
            letter-spacing: 4px;
          }
          .content { padding: 32px; position: relative; z-index: 1; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
          .logo { font-size: 28px; font-weight: 800; color: #111827; letter-spacing: -0.5px; }
          .doc-type { text-align: right; }
          .doc-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: ${isPaid ? '#9ca3af' : '#dc2626'}; margin-bottom: 4px; }
          .doc-number { font-size: 14px; font-weight: 700; color: #111827; }
          .amount-section { text-align: center; padding: 24px 0; margin-bottom: 24px; border-bottom: 2px dashed #e5e7eb; }
          .amount-label { font-size: 11px; color: #6b7280; margin-bottom: 4px; }
          .amount-value { font-size: 36px; font-weight: 800; color: ${isPaid ? '#111827' : '#dc2626'}; }
          .amount-date { font-size: 12px; color: #9ca3af; margin-top: 8px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
          .info-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 4px; }
          .info-value { font-size: 14px; font-weight: 600; color: #111827; }
          .info-sub { font-size: 12px; color: #6b7280; margin-top: 2px; line-height: 1.4; }
          .section-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 12px; }
          .product-card { background: #f9fafb; border: 1px solid #f3f4f6; border-radius: 12px; padding: 16px; margin-bottom: 12px; }
          .product-row { display: flex; justify-content: space-between; align-items: flex-start; }
          .product-name { font-size: 14px; font-weight: 600; color: #111827; }
          .product-qty { font-size: 12px; color: #6b7280; margin-top: 2px; }
          .product-price { font-size: 14px; font-weight: 700; color: #111827; }
          .footer { text-align: center; padding-top: 24px; border-top: 1px solid #f3f4f6; margin-top: 24px; }
          .footer-help { font-size: 10px; color: #9ca3af; margin-bottom: 4px; }
          .footer-contact { font-size: 12px; font-weight: 700; color: #dc2626; }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          <div class="top-stripe"></div>
          <div class="watermark">${watermarkText}</div>
          <div class="content">
            <div class="header">
              <div class="logo">OGABASSEY</div>
              <div class="doc-type">
                <div class="doc-label">${documentTitle}</div>
                <div class="doc-number">#${order.order_number}</div>
              </div>
            </div>

            <div class="amount-section">
              <div class="amount-label">${isPaid ? 'Total Amount' : 'Total to Pay'}</div>
              <div class="amount-value">${total}</div>
              <div class="amount-date">${date} • ${time}</div>
            </div>

            <div class="info-grid">
              <div>
                <div class="info-label">Billed To</div>
                <div class="info-value">${order.customer_name}</div>
                <div class="info-sub">${order.customer_email}</div>
                <div class="info-sub">${order.customer_phone}</div>
              </div>
              <div style="text-align: right;">
                <div class="info-label">Payment Method</div>
                <div class="info-value">${order.payment_method || 'N/A'}</div>
                <div class="info-sub">${isPaid ? 'Verified' : 'Pending'}</div>
              </div>
            </div>

            <div class="section-label">Product Details</div>
            ${order.items
              .map(
                (item: {
                  product_name: string;
                  quantity: number;
                  price: number;
                }) => `
              <div class="product-card">
                <div class="product-row">
                  <div>
                    <div class="product-name">${item.product_name}</div>
                    <div class="product-qty">Qty: ${item.quantity}</div>
                  </div>
                  <div class="product-price">${formatCurrency(item.price * item.quantity)}</div>
                </div>
              </div>
            `
              )
              .join('')}

            <div class="footer">
              <div class="footer-help">Questions regarding this ${documentTitle.toLowerCase()}?</div>
              <div class="footer-contact">help@ogabassey.com • +234 814 697 8921</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
};

export default function OrderDetailsScreen() {
  const { id, action } = useLocalSearchParams<{
    id: string;
    action?: string;
  }>();
  const orderId = Array.isArray(id) ? id[0] : id;
  const actionParam = Array.isArray(action) ? action[0] : action;
  const { colors, shadows } = useTheme();

  // Data Fetching
  const queryClient = useQueryClient();
  const { data: order, isLoading, error } = useOrder(orderId);
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

  const [successModal, setSuccessModal] = useState({
    visible: false,
    title: 'Success!',
    message: '',
    subMessage: '',
  });

  // Formatting Helpers
  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Currency input formatting helpers
  const formatCurrencyInput = (value: string): string => {
    const numericValue = value.replace(/[^0-9]/g, '');
    if (!numericValue) return '';
    const num = Number.parseInt(numericValue, 10);
    return `₦${num.toLocaleString('en-NG')}`;
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

  const loadSavedRiders = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem('saved_riders');
      if (saved) {
        setSavedRiders(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load saved riders', error);
    }
  }, []);

  // Load saved riders
  useEffect(() => {
    loadSavedRiders();
  }, [loadSavedRiders]);

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

    const itemsList = order?.items
      ?.map(
        (item: { quantity: number; name: string }) =>
          `- ${item.quantity}x ${item.name}`
      )
      .join('\n');

    const message = `
📦 *New Order Dispatch*
Order #${order?.order_number}

*Pickup:*
Ogabassey Store
(Your store address here)

*Deliver to:*
${order?.customer_name}
${order?.shipping_address?.address || order?.customer_address}
${order?.shipping_address?.city || ''} ${order?.shipping_address?.state || ''}
Phone: ${order?.customer_phone}

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
                handleStatusUpdate('shipped');
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
    if (!order?.customer_phone) return;

    const message = `
🚚 *Order Update*
Your order #${order.order_number} is on the way!

Rider Contact: ${riderPhone || 'Dispatch Rider'}
Please keep your phone available.

Thank you for choosing Ogabassey!
`.trim();

    const url = `https://wa.me/${order.customer_phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url);
  };

  const handleRecordPayment = async () => {
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
    if (order?.customer_phone) Linking.openURL(`tel:${order.customer_phone}`);
  };

  const handleEmail = () => {
    if (order?.customer_email)
      Linking.openURL(`mailto:${order.customer_email}`);
  };

  const handleWhatsApp = () => {
    if (order?.customer_phone) {
      const phone = order.customer_phone.replace(/\D/g, '');
      Linking.openURL(`https://wa.me/${phone}`);
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
      const hasGadgetItems = order.items?.some(
        (item: { name: string }) =>
          item.name?.toLowerCase().includes('phone') ||
          item.name?.toLowerCase().includes('laptop') ||
          item.name?.toLowerCase().includes('iphone') ||
          item.name?.toLowerCase().includes('samsung') ||
          item.name?.toLowerCase().includes('dell') ||
          item.name?.toLowerCase().includes('hp') ||
          item.name?.toLowerCase().includes('alienware') ||
          item.name?.toLowerCase().includes('gaming')
      );

      if (hasGadgetItems && !order.fulfillment_details?.imei) {
        setShowStatusModal(false);
        setShowFulfillmentModal(true);
        return;
      }
    }

    try {
      await updateStatusMutation.mutateAsync({
        orderId: order.id,
        status: newStatus,
      });
      setShowStatusModal(false);

      // Send shipped notification email when status changes to 'shipped'
      if (newStatus === 'shipped') {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session?.access_token) {
            // Fire and forget - don't block the UI
            fetch(
              `${process.env.EXPO_PUBLIC_API_URL || ''}/api/orders/${order.id}/shipped`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({}), // Could include tracking_number, courier_name etc.
              }
            ).catch(() => {}); // Silently ignore email errors
          }
        } catch {
          // Ignore email errors - status update already succeeded
        }
      }

      // Send delivered notification email when status changes to 'delivered'
      if (newStatus === 'delivered') {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session?.access_token) {
            console.log('UseOrder: Sending delivered email...');
            // Fire and forget - don't block the UI
            fetch(
              `${process.env.EXPO_PUBLIC_API_URL || ''}/api/orders/${order.id}/delivered`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${session.access_token}`,
                },
              }
            )
              .then((res) => {
                if (!res.ok)
                  console.log('UseOrder: Delivered email failed', res.status);
                else console.log('UseOrder: Delivered email sent successfully');
              })
              .catch((err) =>
                console.log('UseOrder: Delivered email fetch error', err)
              );
          }
        } catch (e) {
          console.log('UseOrder: Error in delivered block', e);
        }
      }

      // Send cancellation notification email when status changes to 'cancelled'
      if (newStatus === 'cancelled') {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session?.access_token) {
            console.log('UseOrder: Sending cancelled email...');
            // Fire and forget - don't block the UI
            fetch(
              `${process.env.EXPO_PUBLIC_API_URL || ''}/api/orders/${order.id}/cancelled`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ cancelled_by: 'merchant' }),
              }
            )
              .then((res) => {
                if (!res.ok)
                  console.log('UseOrder: Cancelled email failed', res.status);
                else console.log('UseOrder: Cancelled email sent successfully');
              })
              .catch((err) =>
                console.log('UseOrder: Cancelled email fetch error', err)
              );
          }
        } catch (e) {
          console.log('UseOrder: Error in cancelled block', e);
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
      const { error } = await supabase
        .from('orders')
        .update({
          fulfillment_details: fulfillmentDetails,
          shipping_status: 'shipped',
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (error) throw error;

      setShowFulfillmentModal(false);
      setFulfillmentDetails({ imei: '', serialNumber: '' });
      Alert.alert(
        'Success',
        'Order marked as shipped with fulfillment details'
      );

      queryClient.invalidateQueries({ queryKey: ['order', order.id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    } catch (err: unknown) {
      Alert.alert(
        'Error',
        (err as Error).message || 'Failed to save fulfillment details'
      );
    }
  };

  const handleSendReceipt = async () => {
    if (!order) return;
    try {
      const html = generateReceiptHtml(order);
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
      });
    } catch (_error) {
      Alert.alert('Error', 'Failed to generate receipt');
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
      return [addr.address, addr.city, addr.state].filter(Boolean).join(', ');
    }
    return 'Invalid address format';
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['bottom']}
    >
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
                // If cancelled/returned, all previous steps should be "active" (or at least valid)
                // But simplified: show active up to current
                const isActive = index <= currentStepIndex;
                const isLast = index === steps.length - 1;

                return (
                  <React.Fragment key={step}>
                    <View
                      style={[
                        styles.progressDot,
                        {
                          backgroundColor: isActive
                            ? getStatusColor(step, colors)
                            : colors.border,
                        },
                      ]}
                    >
                      {isActive && (
                        <Ionicons name="checkmark" size={10} color="#FFF" />
                      )}
                    </View>
                    {!isLast && (
                      <View
                        style={[
                          styles.progressLine,
                          {
                            backgroundColor:
                              index < currentStepIndex
                                ? getStatusColor(step, colors)
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
              style={[styles.receiptBtn, { backgroundColor: colors.primary }]}
              onPress={handleSendReceipt}
            >
              <Ionicons name="document-text-outline" size={18} color="#FFF" />
              <Text style={styles.receiptBtnText}>
                {order.payment_status === 'paid' ? 'Receipt' : 'Invoice'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[
                styles.actionBtn,
                { backgroundColor: colors.backgroundLight },
              ]}
              onPress={handleCall}
              activeOpacity={0.7}
            >
              <Ionicons name="call" size={20} color={colors.primary} />
              <Text style={[styles.actionBtnText, { color: colors.primary }]}>
                Call
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionBtn,
                { backgroundColor: colors.backgroundLight },
              ]}
              onPress={handleWhatsApp}
              activeOpacity={0.7}
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
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionBtn,
                { backgroundColor: colors.backgroundLight },
              ]}
              onPress={handleEmail}
              activeOpacity={0.7}
            >
              <Ionicons name="mail" size={20} color={colors.textSecondary} />
              <Text
                style={[styles.actionBtnText, { color: colors.textSecondary }]}
              >
                Email
              </Text>
            </TouchableOpacity>
          </View>

          {/* Rider Actions - Full Width */}
          {order.shipping_status === 'processing' && (
            <TouchableOpacity
              style={[
                styles.actionBtn,
                {
                  backgroundColor: `${colors.warning}20`,
                  marginTop: 12,
                  width: '100%',
                },
              ]}
              onPress={() => setShowRiderModal(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="bicycle" size={20} color={colors.warning} />
              <Text style={[styles.actionBtnText, { color: colors.warning }]}>
                Dispatch Rider
              </Text>
            </TouchableOpacity>
          )}

          {order.shipping_status === 'shipped' && (
            <TouchableOpacity
              style={[
                styles.actionBtn,
                {
                  backgroundColor: `${colors.success}20`,
                  marginTop: 12,
                  width: '100%',
                },
              ]}
              onPress={handleSendRiderToCustomer}
              activeOpacity={0.7}
            >
              <Ionicons name="share-social" size={20} color={colors.success} />
              <Text style={[styles.actionBtnText, { color: colors.success }]}>
                Share Rider Info
              </Text>
            </TouchableOpacity>
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
          {order.items?.map(
            (
              item: {
                id: string;
                name: string;
                quantity: number;
                price: number;
                image_url?: string;
                color?: string;
                size?: string;
                product_id?: string;
              },
              index: number
            ) => (
              <Pressable
                key={item.id}
                style={[
                  styles.itemRow,
                  index !== (order.items?.length || 0) - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  },
                ]}
                onPress={() => router.push(`/product/${item.product_id}`)}
              >
                <View
                  style={[
                    styles.itemImagePlaceholder,
                    { backgroundColor: colors.backgroundLight },
                  ]}
                >
                  {item.image_url ? (
                    <Image
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
            )
          )}
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
                <TouchableOpacity
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
                  activeOpacity={0.7}
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
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.paymentActionBtn,
                    { borderColor: colors.primary },
                  ]}
                  onPress={handleSendReminder}
                  activeOpacity={0.7}
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
                </TouchableOpacity>
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
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
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
                  placeholder="e.g., Trusted customer, will pay on delivery"
                  placeholderTextColor={colors.textSecondary}
                  value={creditNotes}
                  onChangeText={setCreditNotes}
                  multiline
                  style={{ color: colors.text, minHeight: 60 }}
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
        </View>
      )}

      {/* Fulfillment Modal */}
      {showFulfillmentModal && (
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowFulfillmentModal(false)}
          />
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
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
                  placeholder="e.g., 353456789012345"
                  placeholderTextColor={colors.textSecondary}
                  value={fulfillmentDetails.imei}
                  onChangeText={(text) =>
                    setFulfillmentDetails((prev) => ({ ...prev, imei: text }))
                  }
                  keyboardType="numeric"
                  maxLength={15}
                  style={{ color: colors.text }}
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
                  value={fulfillmentDetails.serialNumber}
                  onChangeText={(text) =>
                    setFulfillmentDetails((prev) => ({
                      ...prev,
                      serialNumber: text,
                    }))
                  }
                  style={{ color: colors.text }}
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
        </View>
      )}

      {/* Rider Modal */}
      {showRiderModal && (
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowRiderModal(false)}
          />
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
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
                  {savedRiders.map((phone, index) => (
                    <TouchableOpacity
                      key={index}
                      style={{
                        backgroundColor: colors.backgroundLight,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: RADIUS.full,
                        borderWidth: 1,
                        borderColor:
                          riderPhone === phone ? colors.primary : 'transparent',
                      }}
                      onPress={() => setRiderPhone(phone)}
                    >
                      <Text style={{ color: colors.text, fontSize: 12 }}>
                        {phone}
                      </Text>
                    </TouchableOpacity>
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
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
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
                  placeholder="₦0"
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
                  <TouchableOpacity
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
                        color: paymentMethod === method ? '#FFF' : colors.text,
                        fontWeight: '500',
                        textTransform: 'capitalize',
                      }}
                    >
                      {method === 'pos' ? 'POS' : method}
                    </Text>
                  </TouchableOpacity>
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
        </View>
      )}

      <SuccessModal
        visible={successModal.visible}
        title={successModal.title}
        message={successModal.message}
        subMessage={successModal.subMessage}
        onClose={() => setSuccessModal((prev) => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  progressDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  progressLine: { flex: 1, height: 2, marginHorizontal: -2 },

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
