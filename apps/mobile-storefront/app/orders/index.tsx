/**
 * Orders List Screen
 * Displays customer's order history
 * 2026 Best Practice: Offline-aware with graceful degradation
 */

import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { Redirect, router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OfflineEmptyState, OfflineNotice } from '@/components/OfflineNotice';
import { OrdersListEmptyState } from '@/components/orders/OrdersListEmptyState';
import { OrdersListHeader } from '@/components/orders/OrdersListHeader';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import { useRequireAuth } from '@/hooks/use-auth-guard';
import { useNetworkState } from '@/hooks/use-network-state';
import {
  getCustomerOrderStatusPalette,
  getCustomerOrderStatusMeta,
} from '@/lib/customer-order-status';
import { formatNgnCurrency } from '@/lib/format-ngn-currency';
import { createLogger } from '@/lib/logger';
import {
  buildOrderListFilters,
  matchesOrderListFilter,
  type OrderListFilterKey,
} from '@/lib/order-list-filters';
import { getOrderDisplayTotal } from '@/lib/order-summary';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';

const log = createLogger('OrdersList');

interface Order {
  id: string;
  order_number: string;
  shipping_status: string;
  subtotal: number;
  shipping_fee: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  payment_status: string;
  created_at: string;
  items_count: number;
  items: Array<{
    id: string;
    product_name: string;
    quantity: number;
    price: number;
  }>;
}

export default function OrdersScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const user = useAuthStore((state) => state.user);
  const customer = useAuthStore((state) => state.customer);

  // 2026 Best Practice: Declarative auth-gate with intent-preserving returnTo
  const { redirectTo } = useRequireAuth();

  // 2026 Best Practice: Network state monitoring for offline UX
  const { isOnline, onReconnect } = useNetworkState();

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] =
    useState<OrderListFilterKey>('all');

  const fetchOrders = async () => {
    if (!customer?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          shipping_status,
          subtotal,
          shipping_fee,
          discount_amount,
          tax_amount,
          total,
          payment_status,
          created_at,
          order_items (
            id,
            name,
            quantity,
            price
          )
        `)
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const formattedOrders = (data || []).map((order) => ({
        ...order,
        items_count: (order.order_items ?? []).length,
        items: (order.order_items ?? []).map((item) => ({
          ...item,
          product_name: item.name,
        })),
      }));

      setOrders(formattedOrders);
      setError(null);
    } catch (err) {
      log.error('Error fetching orders:', err);
      setError('Failed to load orders');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchOrders used in multiple places; React Compiler handles memoization (ADR-004)
  useEffect(() => {
    fetchOrders();
  }, [customer?.id]);

  // 2026 Best Practice: Auto-refetch when coming back online
  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchOrders used in multiple places; React Compiler handles memoization (ADR-004)
  useEffect(() => {
    return onReconnect(() => {
      fetchOrders();
    });
  }, [onReconnect]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchOrders();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Declarative auth-gate: redirect to login if not authenticated
  if (redirectTo) {
    return <Redirect href={redirectTo} />;
  }

  const orderFilters = buildOrderListFilters(orders);

  // Filter orders based on the selected chip and search query
  const filteredOrders = orders
    .filter((order) => matchesOrderListFilter(order, selectedFilter))
    .filter((order) => {
      if (!searchQuery.trim()) return true;

      const query = searchQuery.toLowerCase().trim();

      const orderNumberMatch = order.order_number
        ?.toLowerCase()
        .includes(query);
      const statusMeta = getCustomerOrderStatusMeta(order.shipping_status);
      const statusMatch =
        statusMeta.label.toLowerCase().includes(query) ||
        statusMeta.shortLabel.toLowerCase().includes(query);
      const itemMatch = order.items?.some((item) =>
        item.product_name?.toLowerCase().includes(query)
      );

      return orderNumberMatch || statusMatch || itemMatch;
    });

  const renderOrderItem = ({ item }: { item: Order }) => {
    const statusMeta = getCustomerOrderStatusMeta(item.shipping_status);
    const statusPalette = getCustomerOrderStatusPalette(item.shipping_status);
    const primaryItem = item.items[0];
    const secondaryItems = Math.max(item.items.length - 1, 0);
    const displayTotal = getOrderDisplayTotal({
      subtotal: item.subtotal,
      shippingFee: item.shipping_fee,
      taxAmount: item.tax_amount,
      discountAmount: item.discount_amount,
      total: item.total,
      paymentStatus: item.payment_status,
    });

    return (
      <TouchableOpacity
        style={[
          styles.orderCard,
          {
            backgroundColor: colors.card,
            borderColor: statusPalette.border,
            shadowColor: statusPalette.accent,
          },
        ]}
        onPress={() => router.push(`/orders/${item.id}`)}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.orderAccent,
            { backgroundColor: statusPalette.accent },
          ]}
        />

        <View style={styles.orderTopRow}>
          <View style={styles.orderStatusRow}>
            <View
              style={[
                styles.statusIconWrap,
                { backgroundColor: statusPalette.surface },
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
            </View>
            <View style={styles.orderStatusCopy}>
              <Text
                style={[styles.statusHeadline, { color: statusPalette.accent }]}
              >
                {statusMeta.label}
              </Text>
              <Text style={[styles.orderDate, { color: colors.textSecondary }]}>
                Placed {formatDate(item.created_at)}
              </Text>
            </View>
          </View>

          <View style={styles.orderTotalBlock}>
            <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>
              Total
            </Text>
            <Text style={[styles.totalAmount, { color: colors.text }]}>
              {formatNgnCurrency(displayTotal)}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.orderBody,
            { borderTopColor: colors.border, borderBottomColor: colors.border },
          ]}
        >
          <Text
            style={[styles.primaryItemName, { color: colors.text }]}
            numberOfLines={1}
          >
            {primaryItem?.product_name || 'Order items'}
          </Text>
          <Text
            style={[styles.orderNarrative, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {primaryItem
              ? secondaryItems > 0
                ? `+${secondaryItems} more item${secondaryItems === 1 ? '' : 's'}`
                : `${primaryItem.quantity} ${primaryItem.quantity === 1 ? 'item' : 'items'}`
              : `${item.items_count} ${item.items_count === 1 ? 'item' : 'items'}`}
          </Text>
        </View>

        <View style={styles.viewDetails}>
          <Text
            style={[styles.viewDetailsText, { color: statusPalette.accent }]}
          >
            View order details
          </Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={statusPalette.accent}
          />
        </View>
      </TouchableOpacity>
    );
  };

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/account');
  };

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.emptyState}>
          <Ionicons
            name="person-outline"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Sign in to view orders
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            You need to be signed in to see your order history
          </Text>
          <TouchableOpacity
            style={[styles.shopButton, { backgroundColor: BRAND.primary }]}
            onPress={() => router.push('/auth/login')}
          >
            <Text style={styles.shopButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

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

  // 2026 Best Practice: Different error states for offline vs online errors
  if (error) {
    // Show offline-specific empty state when offline
    if (!isOnline) {
      return (
        <View
          style={[
            styles.container,
            styles.centered,
            { backgroundColor: colors.background },
          ]}
        >
          <OfflineEmptyState
            title="Orders Unavailable"
            description="Connect to the internet to view your order history"
            onRetry={fetchOrders}
            isRetrying={isRefreshing}
          />
        </View>
      );
    }

    // Show generic error state when online
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
        <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
        <TouchableOpacity onPress={fetchOrders}>
          <Text style={[styles.retryText, { color: BRAND.primary }]}>
            Tap to retry
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

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
        edges={['top', 'left', 'right']}
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
              Account
            </Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            My Orders
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {!isOnline && orders.length > 0 && (
          <OfflineNotice
            variant="banner"
            showCachedDataNotice
            showRetry
            onRetry={fetchOrders}
            isRetrying={isRefreshing}
          />
        )}

        <FlashList
          data={filteredOrders}
          renderItem={renderOrderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            orders.length === 0 && styles.emptyListContent,
          ]}
          ListEmptyComponent={
            <OrdersListEmptyState
              colors={colors}
              hasOrders={orders.length > 0}
              onClearSearch={() => setSearchQuery('')}
              onStartShopping={() => router.push('/')}
            />
          }
          ListHeaderComponent={
            orders.length > 0 ? (
              <OrdersListHeader
                colors={colors}
                orderFilters={orderFilters}
                selectedFilter={selectedFilter}
                onSelectFilter={setSelectedFilter}
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
                filteredOrdersCount={filteredOrders.length}
              />
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={BRAND.primary}
              colors={[BRAND.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
      </SafeAreaView>
    </>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 2,
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
    width: 88,
  },
  listContent: {
    padding: 16,
    gap: 14,
  },
  emptyListContent: {
    flex: 1,
  },
  orderCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  orderAccent: {
    position: 'absolute',
    left: 0,
    top: 18,
    bottom: 18,
    width: 4,
    borderRadius: 999,
  },
  orderTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  orderStatusRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  statusIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderStatusCopy: {
    flex: 1,
  },
  statusHeadline: {
    fontSize: 15,
    fontWeight: '700',
  },
  orderTotalBlock: {
    alignItems: 'flex-end',
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '600',
  },
  orderDate: {
    fontSize: 13,
    marginTop: 4,
  },
  orderBody: {
    marginTop: 16,
    paddingTop: 14,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  primaryItemName: {
    fontSize: 15,
    fontWeight: '700',
  },
  orderNarrative: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '700',
  },
  viewDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    marginTop: 14,
  },
  viewDetailsText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
  },
  shopButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 24,
  },
  shopButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
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
