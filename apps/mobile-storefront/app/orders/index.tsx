/**
 * Orders List Screen
 * Displays customer's order history
 * 2026 Best Practice: Offline-aware with graceful degradation
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { OfflineEmptyState, OfflineNotice } from '@/components/OfflineNotice';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import { useNetworkState } from '@/hooks/use-network-state';
import { createLogger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';

const log = createLogger('OrdersList');

interface Order {
  id: string;
  order_number: string;
  status: string;
  total: number;
  created_at: string;
  items_count: number;
  items: Array<{
    id: string;
    product_name: string;
    quantity: number;
    price: number;
    image_url?: string;
  }>;
}

const ORDER_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  pending: { label: 'Pending', color: '#F59E0B', icon: 'time-outline' },
  confirmed: {
    label: 'Confirmed',
    color: '#3B82F6',
    icon: 'checkmark-circle-outline',
  },
  processing: {
    label: 'Processing',
    color: '#8B5CF6',
    icon: 'construct-outline',
  },
  shipped: { label: 'Shipped', color: '#6366F1', icon: 'car-outline' },
  out_for_delivery: {
    label: 'Out for Delivery',
    color: '#10B981',
    icon: 'bicycle-outline',
  },
  delivered: {
    label: 'Delivered',
    color: '#059669',
    icon: 'checkmark-done-outline',
  },
  cancelled: {
    label: 'Cancelled',
    color: '#EF4444',
    icon: 'close-circle-outline',
  },
  refunded: { label: 'Refunded', color: '#6B7280', icon: 'refresh-outline' },
};

export default function OrdersScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const user = useAuthStore((state) => state.user);

  // 2026 Best Practice: Network state monitoring for offline UX
  const { isOnline, onReconnect } = useNetworkState();

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchOrders = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          total,
          created_at,
          order_items (
            id,
            product_name,
            quantity,
            price,
            image_url
          )
        `)
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const formattedOrders = (data || []).map((order) => ({
        ...order,
        items_count: (order.order_items ?? []).length,
        items: order.order_items ?? [],
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
  }, [user?.id]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // 2026 Best Practice: Auto-refetch when coming back online
  useEffect(() => {
    return onReconnect(() => {
      fetchOrders();
    });
  }, [onReconnect, fetchOrders]);

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

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const getStatusConfig = (status: string) => {
    return ORDER_STATUS_CONFIG[status] || ORDER_STATUS_CONFIG.pending;
  };

  // Filter orders based on search query (matches web functionality)
  const filteredOrders = orders.filter((order) => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase().trim();

    // Search by order number
    const orderNumberMatch = order.order_number?.toLowerCase().includes(query);

    // Search by status
    const statusConfig = getStatusConfig(order.status);
    const statusMatch = statusConfig.label.toLowerCase().includes(query);

    // Search by product names
    const itemMatch = order.items?.some((item) =>
      item.product_name?.toLowerCase().includes(query)
    );

    return orderNumberMatch || statusMatch || itemMatch;
  });

  const renderOrderItem = ({ item }: { item: Order }) => {
    const statusConfig = getStatusConfig(item.status);

    return (
      <TouchableOpacity
        style={[styles.orderCard, { backgroundColor: colors.card }]}
        onPress={() => router.push(`/orders/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.orderHeader}>
          <View>
            <Text style={[styles.orderNumber, { color: colors.text }]}>
              #{item.order_number}
            </Text>
            <Text style={[styles.orderDate, { color: colors.textSecondary }]}>
              {formatDate(item.created_at)}
            </Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: `${statusConfig.color}20` },
            ]}
          >
            <Ionicons
              name={
                statusConfig.icon as React.ComponentProps<
                  typeof Ionicons
                >['name']
              }
              size={14}
              color={statusConfig.color}
            />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>

        <View style={styles.orderItems}>
          <Text style={[styles.itemsText, { color: colors.textSecondary }]}>
            {item.items_count} {item.items_count === 1 ? 'item' : 'items'}
          </Text>
          {item.items.slice(0, 2).map((orderItem, index) => (
            <Text
              key={orderItem.id || index}
              style={[styles.itemName, { color: colors.text }]}
              numberOfLines={1}
            >
              • {orderItem.product_name} × {orderItem.quantity}
            </Text>
          ))}
          {item.items.length > 2 && (
            <Text style={[styles.moreItems, { color: colors.textSecondary }]}>
              +{item.items.length - 2} more
            </Text>
          )}
        </View>

        <View style={styles.orderFooter}>
          <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>
            Total
          </Text>
          <Text style={[styles.totalAmount, { color: colors.text }]}>
            {formatPrice(item.total)}
          </Text>
        </View>

        <View style={styles.viewDetails}>
          <Text style={[styles.viewDetailsText, { color: BRAND.primary }]}>
            View Details
          </Text>
          <Ionicons name="chevron-forward" size={16} color={BRAND.primary} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    // Show different empty states based on context
    if (orders.length > 0 && filteredOrders.length === 0) {
      // Has orders but search returned no results
      return (
        <View style={styles.emptyState}>
          <Ionicons
            name="search-outline"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No matching orders
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Try searching with a different term
          </Text>
          <TouchableOpacity
            style={[styles.shopButton, { backgroundColor: BRAND.primary }]}
            onPress={() => setSearchQuery('')}
          >
            <Text style={styles.shopButtonText}>Clear Search</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // No orders at all
    return (
      <View style={styles.emptyState}>
        <Ionicons
          name="receipt-outline"
          size={64}
          color={colors.textSecondary}
        />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          No orders yet
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
          When you place orders, they'll appear here
        </Text>
        <TouchableOpacity
          style={[styles.shopButton, { backgroundColor: BRAND.primary }]}
          onPress={() => router.push('/')}
        >
          <Text style={styles.shopButtonText}>Start Shopping</Text>
        </TouchableOpacity>
      </View>
    );
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 2026 Best Practice: Show offline notice when viewing cached data */}
      {!isOnline && orders.length > 0 && (
        <OfflineNotice
          variant="banner"
          showCachedDataNotice
          showRetry
          onRetry={fetchOrders}
          isRetrying={isRefreshing}
        />
      )}

      {/* Search Bar - matches web functionality */}
      {orders.length > 0 && (
        <View
          style={[
            styles.searchContainer,
            { backgroundColor: colors.background },
          ]}
        >
          <View
            style={[
              styles.searchInputContainer,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Ionicons
              name="search-outline"
              size={20}
              color={colors.textSecondary}
            />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search orders, items or status..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name="close-circle"
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>
          {searchQuery.length > 0 && (
            <Text
              style={[styles.searchResults, { color: colors.textSecondary }]}
            >
              {filteredOrders.length}{' '}
              {filteredOrders.length === 1 ? 'order' : 'orders'} found
            </Text>
          )}
        </View>
      )}

      <FlatList
        data={filteredOrders}
        renderItem={renderOrderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          orders.length === 0 && styles.emptyListContent,
        ]}
        ListEmptyComponent={renderEmptyState}
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
    </View>
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
  listContent: {
    padding: 16,
    gap: 12,
  },
  emptyListContent: {
    flex: 1,
  },
  orderCard: {
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '600',
  },
  orderDate: {
    fontSize: 13,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  orderItems: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
  },
  itemsText: {
    fontSize: 12,
    marginBottom: 4,
  },
  itemName: {
    fontSize: 14,
    marginTop: 2,
  },
  moreItems: {
    fontSize: 13,
    marginTop: 4,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 14,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '700',
  },
  viewDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
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
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  searchResults: {
    fontSize: 13,
    marginTop: 8,
    marginLeft: 4,
  },
});
