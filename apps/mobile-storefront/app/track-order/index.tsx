/**
 * Track Order Screen
 * Displays order details for guests using a tracking token.
 * Calls GET /api/storefront/orders/track-order?token=TOKEN&merchant_slug=SLUG
 */

import {
  getCustomerOrderStatusKey,
  getCustomerOrderStatusMeta,
  type CustomerOrderStatusKey,
} from '@/lib/customer-order-status';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, RADIUS, SPACING } from '@/constants/Colors';
import { resolveApiBaseUrl } from '@/lib/api-url';

const API_BASE_URL =
  resolveApiBaseUrl(
    process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl
  );

const MERCHANT_SLUG = Constants.expoConfig?.extra?.merchantSlug || 'ogabassey';

interface TimelineEvent {
  status: string;
  title: string;
  description: string;
  timestamp: string;
  icon:
    | 'order'
    | 'payment'
    | 'processing'
    | 'shipped'
    | 'delivered'
    | 'cancelled'
    | 'returned';
}

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  product_image: string | null;
}

interface TrackOrderData {
  order: {
    id: string;
    order_number: string;
    status: string;
    payment_status: string;
    created_at: string;
    subtotal: number;
    shipping_cost: number;
    discount_amount: number;
    total: number;
    currency: string;
  };
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  shipping_address: {
    address: string;
    city: string;
    state: string;
    country: string;
  };
  items: OrderItem[];
  timeline: TimelineEvent[];
  shipping_tracking: {
    provider: string;
    tracking_number: string;
    tracking_url: string;
  } | null;
  estimated_delivery: string | null;
  merchant: {
    name: string;
    logo: string | null;
    support_email: string | null;
    support_phone: string | null;
  };
}

const TIMELINE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  order: 'receipt-outline',
  payment: 'card-outline',
  processing: 'cog-outline',
  shipped: 'airplane-outline',
  delivered: 'checkmark-circle-outline',
  cancelled: 'close-circle-outline',
  returned: 'return-down-back-outline',
};

const STATUS_COLORS: Record<string, string> = {
  completed: '#10B981',
  current: BRAND.primary,
  pending: '#9CA3AF',
  failed: '#EF4444',
};

function formatPrice(amount: number, currency = 'NGN'): string {
  return `${currency === 'NGN' ? '\u20A6' : currency} ${amount.toLocaleString()}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const CUSTOMER_STATUS_BADGES: Record<
  CustomerOrderStatusKey,
  { color: string; bg: string }
> = {
  placed: { color: BRAND.primary, bg: 'rgba(220, 38, 38, 0.10)' },
  confirmed: { color: '#1E40AF', bg: 'rgba(37, 99, 235, 0.10)' },
  shipped: { color: '#1E40AF', bg: 'rgba(37, 99, 235, 0.10)' },
  delivered: { color: '#065F46', bg: 'rgba(5, 150, 105, 0.10)' },
  cancelled: { color: '#991B1B', bg: 'rgba(220, 38, 38, 0.12)' },
  returned: { color: '#4B5563', bg: 'rgba(107, 114, 128, 0.12)' },
};

export default function TrackOrderScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { trackingToken } = useLocalSearchParams<Record<string, string>>();

  const [data, setData] = useState<TrackOrderData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!trackingToken) {
      setError('No tracking token provided');
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20_000); // 20s timeout

    const fetchOrder = async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/storefront/orders/track-order?token=${encodeURIComponent(trackingToken)}&merchant_slug=${encodeURIComponent(MERCHANT_SLUG)}`,
          { signal: controller.signal }
        );

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(
            (errBody as { error?: string }).error || 'Order not found'
          );
        }

        const json = await res.json();
        setData(json as TrackOrderData);
      } catch (err) {
        if (controller.signal.aborted) {
          setError('Request timed out. Please try again.');
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to load order');
      } finally {
        clearTimeout(timeoutId);
        setIsLoading(false);
      }
    };

    fetchOrder();

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [trackingToken]);

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView
          style={[styles.container, { backgroundColor: colors.background }]}
        >
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={BRAND.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading order details...
            </Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView
          style={[styles.container, { backgroundColor: colors.background }]}
        >
          <View style={styles.centered}>
            <Ionicons
              name="alert-circle-outline"
              size={48}
              color={colors.textSecondary}
            />
            <Text style={[styles.errorText, { color: colors.text }]}>
              {error || 'Order not found'}
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.retryBtn,
                { backgroundColor: BRAND.primary },
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => router.replace('/')}
              accessibilityRole="button"
              accessibilityLabel="Return to home page"
            >
              <Text style={styles.retryBtnText}>Go Home</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </>
    );
  }

  const {
    order,
    customer,
    shipping_address,
    items,
    timeline,
    shipping_tracking,
    estimated_delivery,
    merchant,
  } = data;
  const statusMeta = getCustomerOrderStatusMeta(order.status);
  const badge = CUSTOMER_STATUS_BADGES[getCustomerOrderStatusKey(order.status)];

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
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backBtn,
              pressed && { opacity: 0.7 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={12}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Order Details
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Order Header Card */}
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.orderHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.orderNumber, { color: colors.text }]}>
                  Order #{order.order_number}
                </Text>
                <Text
                  style={[styles.orderDate, { color: colors.textSecondary }]}
                >
                  {formatDate(order.created_at)}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                <Ionicons
                  name={
                    statusMeta.icon as React.ComponentProps<typeof Ionicons>['name']
                  }
                  size={14}
                  color={badge.color}
                />
                <Text style={[styles.badgeText, { color: badge.color }]}>
                  {statusMeta.shortLabel}
                </Text>
              </View>
            </View>

            {estimated_delivery && (
              <View
                style={[styles.estimatedRow, { borderTopColor: colors.border }]}
              >
                <Ionicons name="time-outline" size={16} color={BRAND.primary} />
                <Text
                  style={[
                    styles.estimatedText,
                    { color: colors.textSecondary },
                  ]}
                >
                  Estimated delivery: {estimated_delivery}
                </Text>
              </View>
            )}
          </View>

          {/* Timeline */}
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Order Timeline
            </Text>
            {timeline.map((event, index) => {
              const isLast = index === timeline.length - 1;
              const eventColor =
                STATUS_COLORS[event.status] || STATUS_COLORS.pending;

              return (
                <View
                  key={`${event.icon}-${index}`}
                  style={styles.timelineItem}
                >
                  <View style={styles.timelineLeft}>
                    <View
                      style={[
                        styles.timelineDot,
                        { backgroundColor: eventColor },
                      ]}
                    >
                      <Ionicons
                        name={TIMELINE_ICONS[event.icon] || 'ellipse'}
                        size={14}
                        color="#FFFFFF"
                      />
                    </View>
                    {!isLast && (
                      <View
                        style={[
                          styles.timelineLine,
                          {
                            backgroundColor:
                              event.status === 'completed'
                                ? '#10B981'
                                : colors.border,
                          },
                        ]}
                      />
                    )}
                  </View>
                  <View style={styles.timelineContent}>
                    <Text
                      style={[styles.timelineTitle, { color: colors.text }]}
                    >
                      {event.title}
                    </Text>
                    <Text
                      style={[
                        styles.timelineDesc,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {event.description}
                    </Text>
                    {event.timestamp ? (
                      <Text
                        style={[
                          styles.timelineTime,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {formatDateTime(event.timestamp)}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>

          {/* Shipping Tracking */}
          {shipping_tracking && (
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Shipping Tracking
              </Text>
              <View style={styles.trackingRow}>
                <Ionicons
                  name="airplane-outline"
                  size={20}
                  color={BRAND.primary}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.trackingProvider, { color: colors.text }]}
                  >
                    {shipping_tracking.provider}
                  </Text>
                  <Text
                    style={[
                      styles.trackingNumber,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {shipping_tracking.tracking_number}
                  </Text>
                </View>
                {shipping_tracking.tracking_url && (
                  <Pressable
                    onPress={() => {
                      const url = shipping_tracking.tracking_url;
                      if (url && /^https?:\/\//i.test(url)) {
                        Linking.openURL(url);
                      } else {
                        Alert.alert(
                          'Tracking Unavailable',
                          'No valid tracking link available.'
                        );
                      }
                    }}
                    style={({ pressed }) => [
                      styles.trackBtn,
                      { backgroundColor: BRAND.primaryLight },
                      pressed && { opacity: 0.8 },
                    ]}
                    accessibilityRole="link"
                    accessibilityLabel="Track your order"
                    accessibilityHint="Opens tracking link in browser"
                  >
                    <Text
                      style={[styles.trackBtnText, { color: BRAND.primary }]}
                    >
                      Track
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}

          {/* Items */}
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Items ({items.length})
            </Text>
            {items.map((item) => (
              <View
                key={item.id}
                style={[styles.itemRow, { borderBottomColor: colors.border }]}
              >
                {item.product_image ? (
                  <Image
                    source={{ uri: item.product_image }}
                    style={styles.itemImage}
                  />
                ) : (
                  <View
                    style={[
                      styles.itemImagePlaceholder,
                      { backgroundColor: colors.border },
                    ]}
                  >
                    <Ionicons
                      name="cube-outline"
                      size={20}
                      color={colors.textSecondary}
                    />
                  </View>
                )}
                <View style={styles.itemInfo}>
                  <Text
                    style={[styles.itemName, { color: colors.text }]}
                    numberOfLines={2}
                  >
                    {item.product_name}
                  </Text>
                  <Text
                    style={[styles.itemQty, { color: colors.textSecondary }]}
                  >
                    Qty: {item.quantity}
                  </Text>
                </View>
                <Text style={[styles.itemPrice, { color: colors.text }]}>
                  {formatPrice(item.total_price, order.currency)}
                </Text>
              </View>
            ))}
          </View>

          {/* Order Summary */}
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
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
                {formatPrice(order.subtotal, order.currency)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text
                style={[styles.summaryLabel, { color: colors.textSecondary }]}
              >
                Shipping
              </Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {order.shipping_cost > 0
                  ? formatPrice(order.shipping_cost, order.currency)
                  : 'Free'}
              </Text>
            </View>
            {order.discount_amount > 0 && (
              <View style={styles.summaryRow}>
                <Text
                  style={[styles.summaryLabel, { color: colors.textSecondary }]}
                >
                  Discount
                </Text>
                <Text style={[styles.summaryValue, { color: '#10B981' }]}>
                  -{formatPrice(order.discount_amount, order.currency)}
                </Text>
              </View>
            )}
            <View
              style={[
                styles.summaryDivider,
                { backgroundColor: colors.border },
              ]}
            />
            <View style={styles.summaryRow}>
              <Text style={[styles.totalLabel, { color: colors.text }]}>
                Total
              </Text>
              <Text style={[styles.totalValue, { color: colors.text }]}>
                {formatPrice(order.total, order.currency)}
              </Text>
            </View>
          </View>

          {/* Shipping Address */}
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Shipping Address
            </Text>
            <View style={styles.addressRow}>
              <Ionicons
                name="location-outline"
                size={20}
                color={BRAND.primary}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.addressName, { color: colors.text }]}>
                  {customer.name}
                </Text>
                <Text
                  style={[styles.addressText, { color: colors.textSecondary }]}
                >
                  {shipping_address.address}
                </Text>
                {(shipping_address.city || shipping_address.state) && (
                  <Text
                    style={[
                      styles.addressText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {[shipping_address.city, shipping_address.state]
                      .filter(Boolean)
                      .join(', ')}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Merchant Contact */}
          {(merchant.support_email || merchant.support_phone) && (
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Need Help?
              </Text>
              <Text
                style={[styles.contactDesc, { color: colors.textSecondary }]}
              >
                Contact {merchant.name} for any questions about your order.
              </Text>
              <View style={styles.contactRow}>
                {merchant.support_email && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.contactBtn,
                      { borderColor: colors.border },
                      pressed && { opacity: 0.7, backgroundColor: colors.border + '20' },
                    ]}
                    onPress={() =>
                      Linking.openURL(`mailto:${merchant.support_email}`)
                    }
                    accessibilityRole="link"
                    accessibilityLabel={`Email ${merchant.name} support`}
                    accessibilityHint="Opens your email app"
                  >
                    <Ionicons
                      name="mail-outline"
                      size={18}
                      color={BRAND.primary}
                    />
                    <Text
                      style={[styles.contactBtnText, { color: colors.text }]}
                    >
                      Email
                    </Text>
                  </Pressable>
                )}
                {merchant.support_phone && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.contactBtn,
                      { borderColor: colors.border },
                      pressed && { opacity: 0.7, backgroundColor: colors.border + '20' },
                    ]}
                    onPress={() =>
                      Linking.openURL(`tel:${merchant.support_phone}`)
                    }
                    accessibilityRole="link"
                    accessibilityLabel={`Call ${merchant.name} support`}
                    accessibilityHint="Opens your phone dialer"
                  >
                    <Ionicons
                      name="call-outline"
                      size={18}
                      color={BRAND.primary}
                    />
                    <Text
                      style={[styles.contactBtnText, { color: colors.text }]}
                    >
                      Call
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Bottom Action */}
        <View
          style={[
            styles.bottomAction,
            { backgroundColor: colors.card, borderTopColor: colors.border },
          ]}
        >
          <Pressable
            style={({ pressed }) => [
              styles.homeBtn,
              { backgroundColor: BRAND.primary },
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => router.replace('/')}
            accessibilityRole="button"
            accessibilityLabel="Continue shopping"
          >
            <Text style={styles.homeBtnText}>Continue Shopping</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
    marginTop: 8,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    marginTop: 8,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
    gap: 12,
  },
  card: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
  },
  orderHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderNumber: {
    fontSize: 17,
    fontWeight: '700',
  },
  orderDate: {
    fontSize: 13,
    marginTop: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  estimatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  estimatedText: {
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  // Timeline
  timelineItem: {
    flexDirection: 'row',
    minHeight: 60,
  },
  timelineLeft: {
    width: 32,
    alignItems: 'center',
  },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginVertical: 4,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 16,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  timelineDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  timelineTime: {
    fontSize: 11,
    marginTop: 4,
  },
  // Shipping tracking
  trackingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  trackingProvider: {
    fontSize: 14,
    fontWeight: '600',
  },
  trackingNumber: {
    fontSize: 13,
    marginTop: 2,
  },
  trackBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
  },
  trackBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Items
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  itemImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  itemImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
  },
  itemQty: {
    fontSize: 12,
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Order summary
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  summaryDivider: {
    height: 1,
    marginVertical: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  // Address
  addressRow: {
    flexDirection: 'row',
    gap: 12,
  },
  addressName: {
    fontSize: 14,
    fontWeight: '600',
  },
  addressText: {
    fontSize: 13,
    marginTop: 2,
  },
  // Contact
  contactDesc: {
    fontSize: 13,
    marginBottom: 12,
  },
  contactRow: {
    flexDirection: 'row',
    gap: 12,
  },
  contactBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
  },
  contactBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Bottom
  bottomSpacer: {
    height: 20,
  },
  bottomAction: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  homeBtn: {
    paddingVertical: 16,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  homeBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
