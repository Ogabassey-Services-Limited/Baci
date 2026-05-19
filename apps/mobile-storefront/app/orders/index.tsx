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
import { OrdersListItem } from '@/components/orders/OrdersListItem';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import { useRequireAuth } from '@/hooks/use-auth-guard';
import { useNetworkState } from '@/hooks/use-network-state';
import { getCustomerOrderStatusMeta } from '@/lib/customer-order-status';
import { createLogger } from '@/lib/logger';
import {
  buildOrderListFilters,
  matchesOrderListFilter,
  type OrderListFilterKey,
} from '@/lib/order-list-filters';
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
          renderItem={({ item }) => (
            <OrdersListItem
              item={item}
              colors={colors}
              formatDate={formatDate}
              onPress={(orderId) => router.push(`/orders/${orderId}`)}
            />
          )}
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
