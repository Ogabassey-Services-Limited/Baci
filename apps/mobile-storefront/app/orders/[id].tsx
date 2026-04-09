/**
 * Order Details Screen
 * Shows full order information, items, and tracking
 */

import { Ionicons } from '@expo/vector-icons';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ReceiptPreviewModal } from '@/components/receipts/ReceiptPreviewModal';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import { SUPPORT_WHATSAPP_PHONE } from '@/constants/Support';
import { useReceiptPreview } from '@/hooks/use-receipt-preview';
import { useMerchantReceiptInfo } from '@/hooks/use-receipts';
import {
  CUSTOMER_ORDER_PROGRESS_STEPS,
  getCustomerOrderProgressState,
  getCustomerOrderStatusMeta,
  isCustomerOrderClosed,
} from '@/lib/customer-order-status';
import { createLogger } from '@/lib/logger';
import {
  getOrderAssuranceFeeTotal,
  getOrderSummaryBreakdown,
} from '@/lib/order-summary';
import {
  BACI_GOOGLE_REVIEW_URL,
  canLeaveStorefrontGoogleReview,
  canRequestStorefrontOrderReturn,
  canShowStorefrontRiderContact,
  isStorefrontReceiptAvailable,
} from '@/lib/post-purchase-actions';
import { supabase } from '@/lib/supabase';
import { isOrderRealtimePayload } from '@/lib/validation';
import { useAuthStore } from '@/stores/auth-store';

const log = createLogger('OrderDetails');

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  product_slug: string;
  quantity: number;
  price: number;
  image_url?: string;
  has_assurance?: boolean;
  assurance_fee?: number;
}

interface InsurancePolicy {
  mycover_policy_number: string | null;
  coverage_amount: number;
  premium_amount: number;
  status: string;
  claim_status: string | null;
  policy_start_date: string | null;
  policy_expiry_date: string | null;
  certificate_url: string | null;
  provider_name: string | null;
  policy_type: string | null;
}

interface OrderDetails {
  id: string;
  order_number: string;
  shipping_status: string;
  subtotal: number;
  shipping_fee: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  payment_method: string;
  payment_status: string;
  created_at: string;
  updated_at: string;
  shipping_address: {
    name: string;
    phone: string;
    address: string;
    city: string;
    state: string;
  };
  tracking_number?: string;
  shipping_provider?: string;
  notes?: string;
  items: OrderItem[];
}

const ORDER_STATUS_PALETTES = {
  placed: {
    accent: BRAND.primary,
    surface: 'rgba(220, 38, 38, 0.10)',
    border: 'rgba(220, 38, 38, 0.18)',
  },
  confirmed: {
    accent: '#2563EB',
    surface: 'rgba(37, 99, 235, 0.10)',
    border: 'rgba(37, 99, 235, 0.18)',
  },
  shipped: {
    accent: '#7C3AED',
    surface: 'rgba(124, 58, 237, 0.10)',
    border: 'rgba(124, 58, 237, 0.18)',
  },
  delivered: {
    accent: '#059669',
    surface: 'rgba(5, 150, 105, 0.10)',
    border: 'rgba(5, 150, 105, 0.18)',
  },
  cancelled: {
    accent: '#DC2626',
    surface: 'rgba(220, 38, 38, 0.10)',
    border: 'rgba(220, 38, 38, 0.18)',
  },
  returned: {
    accent: '#6B7280',
    surface: 'rgba(107, 114, 128, 0.12)',
    border: 'rgba(107, 114, 128, 0.18)',
  },
} as const;

export default function OrderDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme ?? 'light'];
  const user = useAuthStore((state) => state.user);
  const customer = useAuthStore((state) => state.customer);
  const { data: merchantInfo } = useMerchantReceiptInfo();
  const receiptPreview = useReceiptPreview();

  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [insurancePolicy, setInsurancePolicy] =
    useState<InsurancePolicy | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Realtime subscription channel ref for cleanup
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!id) return;

    // Auth check: require authenticated user to view order details
    if (!user?.id || !customer?.id) {
      setError('Please sign in to view order details');
      setIsLoading(false);
      return;
    }

    const fetchOrder = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('orders')
          .select(`
            id,
            order_number,
            shipping_status,
            subtotal,
            shipping_fee,
            tax_amount,
            discount_amount,
            total,
            payment_method,
            payment_status,
            created_at,
            updated_at,
            shipping_address,
            tracking_number,
            shipping_provider,
            notes,
            order_items (
              id,
              product_id,
              name,
              quantity,
              price,
              has_assurance,
              assurance_fee,
              products (
                slug,
                images
              )
            )
          `)
          .eq('id', id)
          .eq('customer_id', customer.id)
          .single();

        if (fetchError) throw fetchError;

        setOrder({
          ...data,
          items: (data.order_items ?? []).map(
            (item: Record<string, unknown>) => {
              const product = Array.isArray(item.products)
                ? item.products[0]
                : item.products;
              return {
                id: item.id as string,
                product_id: item.product_id as string,
                product_name: item.name as string,
                product_slug: (product?.slug as string) ?? '',
                quantity: item.quantity as number,
                price: item.price as number,
                image_url: (product?.images as string[] | null)?.[0],
                has_assurance: item.has_assurance as boolean | undefined,
                assurance_fee: item.assurance_fee as number | undefined,
              };
            }
          ),
        });

        // Fetch insurance policy directly for this order — query unconditionally
        // so policies are shown even when item has_assurance flags are inconsistent.
        const { data: policy } = await supabase
          .from('order_insurance_policies')
          .select(
            'mycover_policy_number, coverage_amount, premium_amount, status, claim_status, policy_start_date, policy_expiry_date, certificate_url, provider_name, policy_type'
          )
          .eq('order_id', id)
          .maybeSingle();

        if (policy) {
          setInsurancePolicy(policy as InsurancePolicy);
        }

        setError(null);
      } catch (err) {
        log.error('Error fetching order:', err);
        setError('Failed to load order details');
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrder();
  }, [id, user?.id, customer?.id]);

  // Supabase Realtime subscription for live order status updates
  useEffect(() => {
    if (!id) return;

    // Create a unique channel for this order
    const channel = supabase
      .channel(`order-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          log.debug('Order updated in realtime:', payload);

          // 2026 Best Practice: Type guard for realtime payloads
          if (!isOrderRealtimePayload(payload)) {
            log.warn('Invalid order realtime payload:', payload);
            return;
          }

          // Update the order state with validated data from realtime
          setOrder((prevOrder) => {
            if (!prevOrder) return prevOrder;
            return {
              ...prevOrder,
              shipping_status:
                payload.new.shipping_status ?? prevOrder.shipping_status,
              tracking_number:
                payload.new.tracking_number ?? prevOrder.tracking_number,
              shipping_provider:
                payload.new.shipping_provider ?? prevOrder.shipping_provider,
              updated_at: payload.new.updated_at ?? prevOrder.updated_at,
            };
          });
        }
      )
      .subscribe((status) => {
        log.debug('Realtime subscription status:', status);
      });

    channelRef.current = channel;

    // Cleanup: remove channel on unmount to prevent stale subscription errors
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [id]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const handleTrackOrder = () => {
    const trackingNumber = order?.tracking_number;
    const provider = order?.shipping_provider?.toLowerCase();

    if (!trackingNumber) {
      Alert.alert(
        'Tracking Unavailable',
        'No tracking information is available for this order yet.'
      );
      return;
    }

    // Compute tracking URL from provider + tracking number
    // Mirrors web API: apps/web/src/app/api/storefront/orders/track-order/route.ts
    const encoded = encodeURIComponent(trackingNumber);
    const providerUrls: Record<string, string> = {
      topship: `https://topship.africa/track/${encoded}`,
      gigl: `https://giglogistics.com/track/${encoded}`,
      dhl: `https://www.dhl.com/en/express/tracking.html?AWB=${encoded}`,
      fedex: `https://www.fedex.com/fedextrack/?trknbr=${encoded}`,
      ups: `https://www.ups.com/track?tracknum=${encoded}`,
    };

    const url = provider ? providerUrls[provider] : undefined;
    if (url) {
      Linking.openURL(url);
    } else {
      Alert.alert(
        'Tracking Unavailable',
        'No tracking link is available for this shipping provider.'
      );
    }
  };

  const handleContactSupport = () => {
    Linking.openURL(
      `https://wa.me/${SUPPORT_WHATSAPP_PHONE}?text=${encodeURIComponent('Hi, I need help with my order')}`
    );
  };

  const handleOpenReceipt = () => {
    if (!order) {
      return;
    }

    receiptPreview.openPreviewByOrderId(order.id);
  };

  const handleLeaveGoogleReview = () => {
    Linking.openURL(BACI_GOOGLE_REVIEW_URL);
  };

  const handleCallRider = () => {
    const riderPhone = merchantInfo?.rider_phone_number?.trim();

    if (!riderPhone) {
      Alert.alert(
        'Rider Contact Unavailable',
        'The rider phone number has not been added yet.'
      );
      return;
    }

    Linking.openURL(`tel:${riderPhone}`);
  };

  const handleReturnOrder = () => {
    Alert.alert(
      'Return Order',
      'In-app returns are coming next. For now, contact support to start a return for this order.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Contact Support', onPress: handleContactSupport },
      ]
    );
  };

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/orders/index');
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView
          style={[styles.container, { backgroundColor: colors.background }]}
          edges={['left', 'right']}
        >
          <View
            style={[
              styles.container,
              styles.centered,
              { backgroundColor: colors.background },
            ]}
          >
            <ActivityIndicator size="large" color={BRAND.primary} />
          </View>
        </SafeAreaView>
      </>
    );
  }

  if (error || !order) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView
          style={[styles.container, { backgroundColor: colors.background }]}
          edges={['left', 'right']}
        >
          <View
            style={[
              styles.container,
              styles.centered,
              { backgroundColor: colors.background },
            ]}
          >
            <Ionicons
              name="alert-circle-outline"
              size={48}
              color={colors.textSecondary}
            />
            <Text style={[styles.errorText, { color: colors.text }]}>
              {error || 'Order not found'}
            </Text>
            <TouchableOpacity onPress={handleGoBack}>
              <Text style={[styles.retryText, { color: BRAND.primary }]}>
                Go back
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </>
    );
  }

  const statusMeta = getCustomerOrderStatusMeta(order.shipping_status);
  const statusPalette = ORDER_STATUS_PALETTES[statusMeta.key];
  const isClosedOrder = isCustomerOrderClosed(order.shipping_status);
  const orderAssuranceFee = getOrderAssuranceFeeTotal(
    order.items,
    insurancePolicy?.premium_amount
  );
  const summaryBreakdown = getOrderSummaryBreakdown({
    subtotal: order.subtotal,
    shippingFee: order.shipping_fee,
    taxAmount: order.tax_amount,
    discountAmount: order.discount_amount,
    total: order.total,
    paymentStatus: order.payment_status,
    assuranceFee: orderAssuranceFee,
  });
  const isReceiptReady = isStorefrontReceiptAvailable({
    paymentStatus: order.payment_status,
    shippingStatus: order.shipping_status,
  });
  const canShowRiderContact =
    canShowStorefrontRiderContact(order.shipping_status) &&
    Boolean(merchantInfo?.rider_phone_number);
  const canLeaveReview = canLeaveStorefrontGoogleReview(order.shipping_status);
  const canReturnOrder = canRequestStorefrontOrderReturn(order.shipping_status);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          gestureEnabled: true,
        }}
      />
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['left', 'right']}
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={handleGoBack}
            style={[styles.backButton, { borderColor: colors.border }]}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={18} color={colors.text} />
            <Text style={[styles.backButtonText, { color: colors.text }]}>
              My Orders
            </Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Order Details
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Order Header */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: statusPalette.border,
                borderWidth: 1,
              },
            ]}
          >
            <View style={styles.orderHeader}>
              <View
                style={[
                  styles.orderHeaderIcon,
                  { backgroundColor: statusPalette.surface },
                ]}
              >
                <Ionicons
                  name={
                    statusMeta.icon as React.ComponentProps<
                      typeof Ionicons
                    >['name']
                  }
                  size={20}
                  color={statusPalette.accent}
                />
              </View>
              <View style={styles.orderHeaderCopy}>
                <View style={styles.orderHeaderTopRow}>
                  <Text style={[styles.orderNumber, { color: colors.text }]}>
                    Order #{order.order_number}
                  </Text>
                  <View
                    style={[
                      styles.statusChip,
                      { backgroundColor: statusPalette.surface },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusChipText,
                        { color: statusPalette.accent },
                      ]}
                    >
                      {statusMeta.shortLabel}
                    </Text>
                  </View>
                </View>
                <Text
                  style={[styles.orderDate, { color: colors.textSecondary }]}
                >
                  {formatDate(order.created_at)}
                </Text>
                <Text
                  style={[
                    styles.orderStatusDescription,
                    { color: colors.textSecondary },
                  ]}
                >
                  {statusMeta.description}
                </Text>
              </View>
            </View>
          </View>

          {/* Order Status Timeline */}
          {!isClosedOrder && (
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Order Status
              </Text>
              <View
                style={[
                  styles.timelineTrack,
                  { backgroundColor: colors.border },
                ]}
              />
              <View style={styles.timeline}>
                {CUSTOMER_ORDER_PROGRESS_STEPS.map((step) => {
                  const progressState = getCustomerOrderProgressState(
                    order.shipping_status,
                    step.key
                  );
                  const isCompleted = progressState === 'completed';
                  const isCurrent = progressState === 'current';
                  const isUpcoming = progressState === 'upcoming';

                  return (
                    <View key={step.key} style={styles.timelineStep}>
                      <View
                        style={[
                          styles.timelineIcon,
                          (isCompleted || isCurrent) && {
                            backgroundColor: isCurrent
                              ? statusPalette.accent
                              : statusPalette.surface,
                            borderColor: isCurrent
                              ? statusPalette.accent
                              : statusPalette.border,
                          },
                          isUpcoming && {
                            backgroundColor: colors.muted,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <Ionicons
                          name={
                            step.icon as React.ComponentProps<
                              typeof Ionicons
                            >['name']
                          }
                          size={16}
                          color={
                            isCurrent
                              ? '#FFF'
                              : isCompleted
                                ? statusPalette.accent
                                : colors.textSecondary
                          }
                        />
                      </View>
                      <Text
                        style={[
                          styles.timelineLabel,
                          {
                            color: isCurrent
                              ? statusPalette.accent
                              : colors.text,
                          },
                          isCurrent && styles.timelineLabelActive,
                        ]}
                        numberOfLines={1}
                      >
                        {step.label}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <View
                style={[
                  styles.timelineSummary,
                  {
                    backgroundColor: statusPalette.surface,
                    borderColor: statusPalette.border,
                  },
                ]}
              >
                <Ionicons
                  name={
                    statusMeta.icon as React.ComponentProps<
                      typeof Ionicons
                    >['name']
                  }
                  size={18}
                  color={statusPalette.accent}
                />
                <View style={styles.timelineSummaryCopy}>
                  <Text
                    style={[
                      styles.timelineSummaryTitle,
                      { color: statusPalette.accent },
                    ]}
                  >
                    {statusMeta.label}
                  </Text>
                  <Text
                    style={[
                      styles.timelineSummaryDescription,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {statusMeta.description}
                  </Text>
                </View>
              </View>

              {order.tracking_number && (
                <TouchableOpacity
                  style={[styles.trackButton, { borderColor: BRAND.primary }]}
                  onPress={handleTrackOrder}
                >
                  <Ionicons
                    name="location-outline"
                    size={18}
                    color={BRAND.primary}
                  />
                  <Text
                    style={[styles.trackButtonText, { color: BRAND.primary }]}
                  >
                    Track Order
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Cancelled/Refunded Status */}
          {isClosedOrder && (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: statusPalette.surface,
                  borderColor: statusPalette.border,
                  borderWidth: 1,
                },
              ]}
            >
              <View style={styles.cancelledStatus}>
                <Ionicons
                  name={
                    statusMeta.icon as React.ComponentProps<
                      typeof Ionicons
                    >['name']
                  }
                  size={24}
                  color={statusPalette.accent}
                />
                <View style={styles.cancelledCopy}>
                  <Text
                    style={[
                      styles.cancelledText,
                      { color: statusPalette.accent },
                    ]}
                  >
                    {statusMeta.label}
                  </Text>
                  <Text
                    style={[
                      styles.cancelledSubtext,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {statusMeta.description}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Order Items */}
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Items ({order.items.length})
            </Text>
            {order.items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.orderItem}
                onPress={() => router.push(`/product/${item.product_slug}`)}
              >
                <Image
                  source={{
                    uri: item.image_url || 'https://via.placeholder.com/80',
                  }}
                  style={styles.itemImage}
                />
                <View style={styles.itemDetails}>
                  <Text
                    style={[styles.itemName, { color: colors.text }]}
                    numberOfLines={2}
                  >
                    {item.product_name}
                  </Text>
                  <View style={styles.itemPriceRow}>
                    <Text
                      style={[
                        styles.itemQuantity,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Qty: {item.quantity}
                    </Text>
                    <Text style={[styles.itemPrice, { color: colors.text }]}>
                      {formatPrice(item.price * item.quantity)}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Insurance Coverage */}
          {insurancePolicy && (
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <View style={styles.insuranceHeader}>
                <Ionicons name="shield-checkmark" size={20} color="#059669" />
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: colors.text, marginBottom: 0, marginLeft: 8 },
                  ]}
                >
                  Insurance Coverage
                </Text>
              </View>
              <View style={styles.insuranceContent}>
                {insurancePolicy.mycover_policy_number && (
                  <View style={styles.insuranceRow}>
                    <Text
                      style={[
                        styles.insuranceLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Policy No.
                    </Text>
                    <Text
                      style={[styles.insuranceValue, { color: colors.text }]}
                    >
                      {insurancePolicy.mycover_policy_number}
                    </Text>
                  </View>
                )}
                <View style={styles.insuranceRow}>
                  <Text
                    style={[
                      styles.insuranceLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Coverage
                  </Text>
                  <Text style={[styles.insuranceValue, { color: colors.text }]}>
                    {formatPrice(insurancePolicy.coverage_amount)}
                  </Text>
                </View>
                <View style={styles.insuranceRow}>
                  <Text
                    style={[
                      styles.insuranceLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Premium
                  </Text>
                  <Text style={[styles.insuranceValue, { color: colors.text }]}>
                    {formatPrice(insurancePolicy.premium_amount)}
                  </Text>
                </View>
                <View style={styles.insuranceRow}>
                  <Text
                    style={[
                      styles.insuranceLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Status
                  </Text>
                  <View
                    style={[
                      styles.insuranceStatusBadge,
                      {
                        backgroundColor:
                          insurancePolicy.status === 'active'
                            ? '#DCFCE7'
                            : '#FEF3C7',
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color:
                          insurancePolicy.status === 'active'
                            ? '#059669'
                            : '#D97706',
                        textTransform: 'capitalize',
                      }}
                    >
                      {insurancePolicy.status}
                    </Text>
                  </View>
                </View>
                {insurancePolicy.claim_status && (
                  <View style={styles.insuranceRow}>
                    <Text
                      style={[
                        styles.insuranceLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Claim
                    </Text>
                    <Text
                      style={[
                        styles.insuranceValue,
                        { color: colors.text, textTransform: 'capitalize' },
                      ]}
                    >
                      {insurancePolicy.claim_status}
                    </Text>
                  </View>
                )}
                <Text
                  style={[
                    styles.insuranceProvider,
                    { color: colors.textSecondary },
                  ]}
                >
                  Protected by MyCover.ai /{' '}
                  {insurancePolicy.provider_name ||
                    'Sovereign Trust Insurance Plc'}
                </Text>
                {insurancePolicy.certificate_url && (
                  <TouchableOpacity
                    style={[
                      styles.trackButton,
                      { borderColor: '#059669', marginTop: 12 },
                    ]}
                    onPress={() =>
                      Linking.openURL(insurancePolicy.certificate_url as string)
                    }
                    accessibilityRole="button"
                    accessibilityLabel="Download insurance certificate"
                  >
                    <Ionicons
                      name="document-text-outline"
                      size={18}
                      color="#059669"
                    />
                    <Text
                      style={[styles.trackButtonText, { color: '#059669' }]}
                    >
                      Download Certificate
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Assurance pending state — order has assurance items but no policy yet */}
          {!insurancePolicy &&
            order.payment_status === 'paid' &&
            order.items.some((item) => item.has_assurance) && (
              <View style={[styles.card, { backgroundColor: colors.card }]}>
                <View style={styles.insuranceHeader}>
                  <Ionicons
                    name="shield-outline"
                    size={20}
                    color={colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.sectionTitle,
                      { color: colors.text, marginBottom: 0, marginLeft: 8 },
                    ]}
                  >
                    Insurance Coverage
                  </Text>
                </View>
                <Text
                  style={[
                    styles.insuranceProvider,
                    { color: colors.textSecondary, marginTop: 12 },
                  ]}
                >
                  Your shipping protection is being processed...
                </Text>
              </View>
            )}

          {/* Shipping Address */}
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Shipping Address
            </Text>
            <View style={styles.addressContent}>
              <View
                style={[
                  styles.addressIconRail,
                  {
                    backgroundColor: isDark
                      ? 'rgba(217, 59, 48, 0.14)'
                      : `${BRAND.primary}12`,
                  },
                ]}
              >
                <Ionicons
                  name="location"
                  size={18}
                  color={BRAND.primary}
                  style={{ textAlign: 'center', marginLeft: 1 }}
                />
              </View>
              <View style={styles.addressDetails}>
                {!!order.shipping_address?.name && (
                  <Text style={[styles.addressName, { color: colors.text }]}>
                    {order.shipping_address.name}
                  </Text>
                )}
                {!!order.shipping_address?.phone && (
                  <Text
                    style={[
                      styles.addressLine,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {order.shipping_address.phone}
                  </Text>
                )}
                {!!order.shipping_address?.address && (
                  <Text
                    style={[
                      styles.addressLine,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {order.shipping_address.address}
                  </Text>
                )}
                {(!!order.shipping_address?.city ||
                  !!order.shipping_address?.state) && (
                  <Text
                    style={[
                      styles.addressLine,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {[
                      order.shipping_address?.city,
                      order.shipping_address?.state,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Order Summary */}
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Order Summary
            </Text>
            <View style={styles.summaryRow}>
              <Text
                style={[styles.summaryLabel, { color: colors.textSecondary }]}
              >
                Subtotal
              </Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {formatPrice(summaryBreakdown.itemsSubtotal)}
              </Text>
            </View>
            {summaryBreakdown.assuranceFee > 0 && (
              <View style={styles.summaryRow}>
                <Text
                  style={[styles.summaryLabel, { color: colors.textSecondary }]}
                >
                  Device Assurance
                </Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>
                  {formatPrice(summaryBreakdown.assuranceFee)}
                </Text>
              </View>
            )}
            <View style={styles.summaryRow}>
              <Text
                style={[styles.summaryLabel, { color: colors.textSecondary }]}
              >
                Shipping
              </Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {summaryBreakdown.shippingFee === 0
                  ? 'Free'
                  : formatPrice(summaryBreakdown.shippingFee)}
              </Text>
            </View>
            {summaryBreakdown.taxAmount > 0 && (
              <View style={styles.summaryRow}>
                <Text
                  style={[styles.summaryLabel, { color: colors.textSecondary }]}
                >
                  VAT
                </Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>
                  {formatPrice(summaryBreakdown.taxAmount)}
                </Text>
              </View>
            )}
            {summaryBreakdown.discountAmount > 0 && (
              <View style={styles.summaryRow}>
                <Text
                  style={[styles.summaryLabel, { color: colors.textSecondary }]}
                >
                  Discount
                </Text>
                <Text style={[styles.summaryValue, { color: '#059669' }]}>
                  -{formatPrice(summaryBreakdown.discountAmount)}
                </Text>
              </View>
            )}
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={[styles.totalLabel, { color: colors.text }]}>
                Total
              </Text>
              <Text style={[styles.totalValue, { color: colors.text }]}>
                {formatPrice(summaryBreakdown.total)}
              </Text>
            </View>
            <View style={styles.paymentInfo}>
              <Text
                style={[styles.paymentMethod, { color: colors.textSecondary }]}
              >
                {order.payment_status === 'paid'
                  ? `Paid via ${order.payment_method?.replace('_', ' ')}`
                  : order.payment_status === 'partially_paid'
                    ? `Partially paid via ${order.payment_method?.replace('_', ' ')}`
                    : order.payment_status === 'pending'
                      ? 'Payment pending'
                      : `${order.payment_method?.replace('_', ' ')} - ${order.payment_status?.replace('_', ' ')}`}
              </Text>
            </View>
          </View>

          {(isReceiptReady ||
            canShowRiderContact ||
            canLeaveReview ||
            canReturnOrder) && (
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Actions
              </Text>
              <View style={styles.actionStack}>
                {isReceiptReady && (
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      { borderColor: colors.border },
                    ]}
                    onPress={handleOpenReceipt}
                    activeOpacity={0.9}
                  >
                    <View
                      style={[
                        styles.actionIconWrap,
                        {
                          backgroundColor: isDark
                            ? 'rgba(5, 150, 105, 0.16)'
                            : 'rgba(5, 150, 105, 0.10)',
                        },
                      ]}
                    >
                      <Ionicons
                        name="receipt-outline"
                        size={18}
                        color="#059669"
                      />
                    </View>
                    <View style={styles.actionCopy}>
                      <Text
                        style={[styles.actionTitle, { color: colors.text }]}
                      >
                        View Receipt
                      </Text>
                      <Text
                        style={[
                          styles.actionDescription,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Preview and share your order receipt.
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                )}

                {canShowRiderContact && (
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      { borderColor: colors.border },
                    ]}
                    onPress={handleCallRider}
                    activeOpacity={0.9}
                  >
                    <View
                      style={[
                        styles.actionIconWrap,
                        {
                          backgroundColor: isDark
                            ? 'rgba(37, 99, 235, 0.18)'
                            : 'rgba(37, 99, 235, 0.10)',
                        },
                      ]}
                    >
                      <Ionicons name="call-outline" size={18} color="#2563EB" />
                    </View>
                    <View style={styles.actionCopy}>
                      <Text
                        style={[styles.actionTitle, { color: colors.text }]}
                      >
                        Rider {merchantInfo?.rider_phone_number}
                      </Text>
                      <Text
                        style={[
                          styles.actionDescription,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Call the rider directly for a live delivery update.
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                )}

                {canLeaveReview && (
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      { borderColor: colors.border },
                    ]}
                    onPress={handleLeaveGoogleReview}
                    activeOpacity={0.9}
                  >
                    <View
                      style={[
                        styles.actionIconWrap,
                        {
                          backgroundColor: isDark
                            ? 'rgba(245, 158, 11, 0.18)'
                            : 'rgba(245, 158, 11, 0.10)',
                        },
                      ]}
                    >
                      <Ionicons name="star-outline" size={18} color="#D97706" />
                    </View>
                    <View style={styles.actionCopy}>
                      <Text
                        style={[styles.actionTitle, { color: colors.text }]}
                      >
                        Leave a Google Review
                      </Text>
                      <Text
                        style={[
                          styles.actionDescription,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Share your delivery experience publicly.
                      </Text>
                    </View>
                    <Ionicons
                      name="open-outline"
                      size={18}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                )}

                {canReturnOrder && (
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      { borderColor: colors.border },
                    ]}
                    onPress={handleReturnOrder}
                    activeOpacity={0.9}
                  >
                    <View
                      style={[
                        styles.actionIconWrap,
                        {
                          backgroundColor: isDark
                            ? 'rgba(107, 114, 128, 0.18)'
                            : 'rgba(107, 114, 128, 0.10)',
                        },
                      ]}
                    >
                      <Ionicons
                        name="return-down-back-outline"
                        size={18}
                        color="#6B7280"
                      />
                    </View>
                    <View style={styles.actionCopy}>
                      <Text
                        style={[styles.actionTitle, { color: colors.text }]}
                      >
                        Return Order
                      </Text>
                      <Text
                        style={[
                          styles.actionDescription,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Start a return with support while the in-app flow lands.
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Support Button */}
          <TouchableOpacity
            style={[styles.supportButton, { borderColor: colors.border }]}
            onPress={handleContactSupport}
          >
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={20}
              color={BRAND.primary}
            />
            <Text style={[styles.supportButtonText, { color: BRAND.primary }]}>
              Need help with this order?
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>

      <ReceiptPreviewModal
        visible={receiptPreview.isOpen}
        html={receiptPreview.html}
        isPaid={receiptPreview.isPaid}
        onClose={receiptPreview.closePreview}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 96,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 32,
  },
  card: {
    borderRadius: 12,
    padding: 16,
  },
  orderHeader: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  orderHeaderIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderHeaderCopy: {
    flex: 1,
  },
  orderHeaderTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    columnGap: 12,
    rowGap: 8,
    alignItems: 'flex-start',
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: '700',
    flexShrink: 1,
    minWidth: 0,
  },
  orderDate: {
    fontSize: 14,
    marginTop: 4,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  orderStatusDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  timeline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  timelineTrack: {
    height: 2,
    marginTop: 15,
    marginHorizontal: 34,
    marginBottom: -17,
  },
  timelineStep: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  timelineIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  timelineLabel: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 16,
    width: '100%',
    paddingHorizontal: 4,
  },
  timelineLabelActive: {
    fontWeight: '700',
  },
  timelineSummary: {
    marginTop: 18,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  timelineSummaryCopy: {
    flex: 1,
  },
  timelineSummaryTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  timelineSummaryDescription: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
  },
  trackButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  cancelledStatus: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  cancelledCopy: {
    flex: 1,
  },
  cancelledText: {
    fontSize: 15,
    fontWeight: '700',
  },
  cancelledSubtext: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  orderItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
  },
  itemImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  itemDetails: {
    flex: 1,
    marginLeft: 12,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
  },
  itemPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  itemQuantity: {
    fontSize: 13,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '600',
  },
  addressIconRail: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  addressDetails: {
    flex: 1,
  },
  addressName: {
    fontSize: 15,
    fontWeight: '600',
  },
  addressLine: {
    fontSize: 14,
    marginTop: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 14,
  },
  totalRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5E5',
    paddingTop: 12,
    marginTop: 4,
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  paymentInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5E5',
  },
  paymentMethod: {
    fontSize: 13,
    textTransform: 'capitalize',
  },
  actionStack: {
    gap: 12,
  },
  actionButton: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCopy: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  actionDescription: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  supportButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
  insuranceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  insuranceContent: {
    marginTop: 12,
    gap: 10,
  },
  insuranceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  insuranceLabel: {
    fontSize: 14,
  },
  insuranceValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  insuranceStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  insuranceProvider: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  errorText: {
    fontSize: 16,
    marginTop: 12,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
});
