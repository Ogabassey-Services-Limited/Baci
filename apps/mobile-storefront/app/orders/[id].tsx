/**
 * Order Details Screen
 * Shows full order information, items, and tracking
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  product_slug: string;
  quantity: number;
  price: number;
  image_url?: string;
  variant_name?: string;
}

interface OrderDetails {
  id: string;
  order_number: string;
  status: string;
  subtotal: number;
  shipping_fee: number;
  discount: number;
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
  tracking_url?: string;
  notes?: string;
  items: OrderItem[];
}

const ORDER_STATUS_STEPS = [
  { key: 'pending', label: 'Order Placed', icon: 'receipt-outline' },
  { key: 'confirmed', label: 'Confirmed', icon: 'checkmark-circle-outline' },
  { key: 'processing', label: 'Processing', icon: 'construct-outline' },
  { key: 'shipped', label: 'Shipped', icon: 'car-outline' },
  { key: 'delivered', label: 'Delivered', icon: 'checkmark-done-outline' },
];

export default function OrderDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Realtime subscription channel ref for cleanup
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchOrder = useCallback(async () => {
    if (!id) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          subtotal,
          shipping_fee,
          discount,
          total,
          payment_method,
          payment_status,
          created_at,
          updated_at,
          shipping_address,
          tracking_number,
          tracking_url,
          notes,
          order_items (
            id,
            product_id,
            product_name,
            product_slug,
            quantity,
            price,
            image_url,
            variant_name
          )
        `)
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      setOrder({
        ...data,
        items: data.order_items || [],
      });
      setError(null);
    } catch (err) {
      console.error('Error fetching order:', err);
      setError('Failed to load order details');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

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
          console.log('Order updated in realtime:', payload.new);

          // Update the order state with new data from realtime
          setOrder((prevOrder) => {
            if (!prevOrder) return prevOrder;
            return {
              ...prevOrder,
              status: payload.new.status,
              tracking_number: payload.new.tracking_number,
              tracking_url: payload.new.tracking_url,
              updated_at: payload.new.updated_at,
            };
          });
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    channelRef.current = channel;

    // Cleanup: unsubscribe on unmount to prevent memory leaks
    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
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

  const getCurrentStepIndex = (status: string) => {
    if (status === 'cancelled' || status === 'refunded') return -1;
    const index = ORDER_STATUS_STEPS.findIndex((step) => step.key === status);
    return index >= 0 ? index : 0;
  };

  const handleTrackOrder = () => {
    if (order?.tracking_url) {
      Linking.openURL(order.tracking_url);
    }
  };

  const handleContactSupport = () => {
    // Open WhatsApp or email support
    Linking.openURL('https://wa.me/2348000000000');
  };

  if (isLoading) {
    return (
      <View
        style={[
          styles.container,
          styles.centered,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={BRAND.primary} />
      </View>
    );
  }

  if (error || !order) {
    return (
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
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.retryText, { color: BRAND.primary }]}>
            Go back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentStepIndex = getCurrentStepIndex(order.status);
  const isCancelled =
    order.status === 'cancelled' || order.status === 'refunded';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Order Header */}
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.orderHeader}>
          <Text style={[styles.orderNumber, { color: colors.text }]}>
            Order #{order.order_number}
          </Text>
          <Text style={[styles.orderDate, { color: colors.textSecondary }]}>
            {formatDate(order.created_at)}
          </Text>
        </View>
      </View>

      {/* Order Status Timeline */}
      {!isCancelled && (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Order Status
          </Text>
          <View style={styles.timeline}>
            {ORDER_STATUS_STEPS.map((step, index) => {
              const isCompleted = index <= currentStepIndex;
              const isCurrent = index === currentStepIndex;

              return (
                <View key={step.key} style={styles.timelineStep}>
                  <View style={styles.timelineIconContainer}>
                    <View
                      style={[
                        styles.timelineIcon,
                        isCompleted && { backgroundColor: BRAND.primary },
                        !isCompleted && { backgroundColor: colors.border },
                      ]}
                    >
                      <Ionicons
                        name={step.icon as any}
                        size={16}
                        color={isCompleted ? '#FFF' : colors.textSecondary}
                      />
                    </View>
                    {index < ORDER_STATUS_STEPS.length - 1 && (
                      <View
                        style={[
                          styles.timelineLine,
                          isCompleted && { backgroundColor: BRAND.primary },
                          !isCompleted && { backgroundColor: colors.border },
                        ]}
                      />
                    )}
                  </View>
                  <View style={styles.timelineContent}>
                    <Text
                      style={[
                        styles.timelineLabel,
                        { color: isCurrent ? BRAND.primary : colors.text },
                        isCurrent && styles.timelineLabelActive,
                      ]}
                    >
                      {step.label}
                    </Text>
                  </View>
                </View>
              );
            })}
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
              <Text style={[styles.trackButtonText, { color: BRAND.primary }]}>
                Track Order
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Cancelled/Refunded Status */}
      {isCancelled && (
        <View style={[styles.card, { backgroundColor: '#FEE2E2' }]}>
          <View style={styles.cancelledStatus}>
            <Ionicons name="close-circle" size={24} color="#EF4444" />
            <Text style={styles.cancelledText}>
              This order has been {order.status}
            </Text>
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
              {item.variant_name && (
                <Text
                  style={[styles.itemVariant, { color: colors.textSecondary }]}
                >
                  {item.variant_name}
                </Text>
              )}
              <View style={styles.itemPriceRow}>
                <Text
                  style={[styles.itemQuantity, { color: colors.textSecondary }]}
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

      {/* Shipping Address */}
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Shipping Address
        </Text>
        <View style={styles.addressContent}>
          <Ionicons
            name="location-outline"
            size={20}
            color={colors.textSecondary}
          />
          <View style={styles.addressDetails}>
            <Text style={[styles.addressName, { color: colors.text }]}>
              {order.shipping_address?.name}
            </Text>
            <Text style={[styles.addressLine, { color: colors.textSecondary }]}>
              {order.shipping_address?.phone}
            </Text>
            <Text style={[styles.addressLine, { color: colors.textSecondary }]}>
              {order.shipping_address?.address}
            </Text>
            <Text style={[styles.addressLine, { color: colors.textSecondary }]}>
              {order.shipping_address?.city}, {order.shipping_address?.state}
            </Text>
          </View>
        </View>
      </View>

      {/* Order Summary */}
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Order Summary
        </Text>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
            Subtotal
          </Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>
            {formatPrice(order.subtotal)}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
            Shipping
          </Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>
            {order.shipping_fee === 0
              ? 'Free'
              : formatPrice(order.shipping_fee)}
          </Text>
        </View>
        {order.discount > 0 && (
          <View style={styles.summaryRow}>
            <Text
              style={[styles.summaryLabel, { color: colors.textSecondary }]}
            >
              Discount
            </Text>
            <Text style={[styles.summaryValue, { color: '#059669' }]}>
              -{formatPrice(order.discount)}
            </Text>
          </View>
        )}
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={[styles.totalLabel, { color: colors.text }]}>Total</Text>
          <Text style={[styles.totalValue, { color: colors.text }]}>
            {formatPrice(order.total)}
          </Text>
        </View>
        <View style={styles.paymentInfo}>
          <Text style={[styles.paymentMethod, { color: colors.textSecondary }]}>
            Paid via {order.payment_method?.replace('_', ' ')}
          </Text>
        </View>
      </View>

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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
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
    alignItems: 'center',
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: '700',
  },
  orderDate: {
    fontSize: 14,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  timeline: {
    marginLeft: 8,
  },
  timelineStep: {
    flexDirection: 'row',
    minHeight: 48,
  },
  timelineIconContainer: {
    alignItems: 'center',
    width: 32,
  },
  timelineIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
    paddingTop: 6,
  },
  timelineLabel: {
    fontSize: 14,
  },
  timelineLabelActive: {
    fontWeight: '600',
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
    alignItems: 'center',
    gap: 8,
  },
  cancelledText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#EF4444',
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
  itemVariant: {
    fontSize: 12,
    marginTop: 2,
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
  addressContent: {
    flexDirection: 'row',
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
