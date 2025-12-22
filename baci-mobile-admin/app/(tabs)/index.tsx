/**
 * Orders Screen - Main Order Fulfillment Dashboard
 * Real-time order management with status updates
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';

type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  total: number;
  itemCount: number;
  status: OrderStatus;
  createdAt: string;
}

// Mock data - will be replaced with React Query
const MOCK_ORDERS: Order[] = [
  { id: '1', orderNumber: 'ORD-001', customerName: 'John Doe', total: 25000, itemCount: 3, status: 'pending', createdAt: '2025-12-20T10:30:00Z' },
  { id: '2', orderNumber: 'ORD-002', customerName: 'Jane Smith', total: 45000, itemCount: 2, status: 'processing', createdAt: '2025-12-20T09:15:00Z' },
  { id: '3', orderNumber: 'ORD-003', customerName: 'Mike Johnson', total: 12500, itemCount: 1, status: 'shipped', createdAt: '2025-12-19T16:45:00Z' },
];

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: '#F59E0B',
  processing: '#3B82F6',
  shipped: '#8B5CF6',
  delivered: '#10B981',
  cancelled: '#EF4444',
};

export default function OrdersScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');

  const colors = {
    background: isDark ? '#0F172A' : '#F8FAFC',
    card: isDark ? '#1E293B' : '#FFFFFF',
    text: isDark ? '#F8FAFC' : '#0F172A',
    textSecondary: isDark ? '#94A3B8' : '#64748B',
    border: isDark ? '#334155' : '#E2E8F0',
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    // TODO: Implement React Query refetch
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
  };

  const filteredOrders = filter === 'all'
    ? MOCK_ORDERS
    : MOCK_ORDERS.filter((o) => o.status === filter);

  const renderOrder = ({ item }: { item: Order }) => (
    <Pressable
      style={[styles.orderCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/order/${item.id}`)}
    >
      <View style={styles.orderHeader}>
        <Text style={[styles.orderNumber, { color: colors.text }]}>{item.orderNumber}</Text>
        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[item.status] }]} />
          <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] }]}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
      </View>
      <Text style={[styles.customerName, { color: colors.textSecondary }]}>{item.customerName}</Text>
      <View style={styles.orderFooter}>
        <Text style={[styles.orderTotal, { color: colors.text }]}>{formatPrice(item.total)}</Text>
        <Text style={[styles.orderItems, { color: colors.textSecondary }]}>
          {item.itemCount} item{item.itemCount !== 1 ? 's' : ''} • {formatTime(item.createdAt)}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      {/* Filter Tabs */}
      <View style={[styles.filterContainer, { borderBottomColor: colors.border }]}>
        {(['all', 'pending', 'processing', 'shipped'] as const).map((status) => (
          <Pressable
            key={status}
            style={[
              styles.filterTab,
              filter === status && { borderBottomColor: '#3B82F6', borderBottomWidth: 2 },
            ]}
            onPress={() => setFilter(status)}
          >
            <Text
              style={[
                styles.filterText,
                { color: filter === status ? '#3B82F6' : colors.textSecondary },
              ]}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Orders List */}
      <FlatList
        data={filteredOrders}
        renderItem={renderOrder}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#3B82F6" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No orders found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  filterTab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 8,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  orderCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  customerName: {
    fontSize: 14,
    marginBottom: 12,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderTotal: {
    fontSize: 15,
    fontWeight: '700',
  },
  orderItems: {
    fontSize: 13,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
  },
});
