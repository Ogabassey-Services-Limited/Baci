/**
 * Order Details Screen
 * Manage order status and fulfillment
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';

type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  price: number;
}

// Mock order data - will be replaced with React Query
const MOCK_ORDER = {
  id: '1',
  orderNumber: 'ORD-001',
  customerName: 'John Doe',
  customerPhone: '+234 801 234 5678',
  customerEmail: 'john@example.com',
  total: 25000,
  status: 'pending' as OrderStatus,
  createdAt: '2025-12-20T10:30:00Z',
  shippingAddress: '123 Main St, Lagos, Nigeria',
  items: [
    { id: '1', productName: 'Product 1', quantity: 2, price: 10000 },
    { id: '2', productName: 'Product 2', quantity: 1, price: 5000 },
  ] as OrderItem[],
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: '#F59E0B',
  processing: '#3B82F6',
  shipped: '#8B5CF6',
  delivered: '#10B981',
  cancelled: '#EF4444',
};

export default function OrderDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [status, setStatus] = useState(MOCK_ORDER.status);

  const colors = {
    background: isDark ? '#0F172A' : '#F8FAFC',
    card: isDark ? '#1E293B' : '#FFFFFF',
    text: isDark ? '#F8FAFC' : '#0F172A',
    textSecondary: isDark ? '#94A3B8' : '#64748B',
    border: isDark ? '#334155' : '#E2E8F0',
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-NG', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const handleStatusChange = (newStatus: OrderStatus) => {
    setStatus(newStatus);
    // TODO: Implement mutation to update order status
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Order Header */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.header}>
            <Text style={[styles.orderNumber, { color: colors.text }]}>{MOCK_ORDER.orderNumber}</Text>
            <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[status] + '20' }]}>
              <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[status] }]} />
              <Text style={[styles.statusText, { color: STATUS_COLORS[status] }]}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </View>
          </View>
          <Text style={[styles.dateText, { color: colors.textSecondary }]}>
            {formatDate(MOCK_ORDER.createdAt)}
          </Text>
        </View>

        {/* Customer Info */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Customer Information</Text>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={20} color={colors.textSecondary} />
            <Text style={[styles.infoText, { color: colors.text }]}>{MOCK_ORDER.customerName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={20} color={colors.textSecondary} />
            <Text style={[styles.infoText, { color: colors.text }]}>{MOCK_ORDER.customerPhone}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={20} color={colors.textSecondary} />
            <Text style={[styles.infoText, { color: colors.text }]}>{MOCK_ORDER.customerEmail}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={20} color={colors.textSecondary} />
            <Text style={[styles.infoText, { color: colors.text }]}>{MOCK_ORDER.shippingAddress}</Text>
          </View>
        </View>

        {/* Order Items */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Items</Text>
          {MOCK_ORDER.items.map((item) => (
            <View
              key={item.id}
              style={[styles.itemRow, { borderBottomColor: colors.border }]}
            >
              <View style={styles.itemInfo}>
                <Text style={[styles.itemName, { color: colors.text }]}>{item.productName}</Text>
                <Text style={[styles.itemQuantity, { color: colors.textSecondary }]}>
                  Qty: {item.quantity}
                </Text>
              </View>
              <Text style={[styles.itemPrice, { color: colors.text }]}>
                {formatPrice(item.price * item.quantity)}
              </Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: colors.text }]}>Total</Text>
            <Text style={[styles.totalValue, { color: colors.text }]}>
              {formatPrice(MOCK_ORDER.total)}
            </Text>
          </View>
        </View>

        {/* Status Actions */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Update Status</Text>
          <View style={styles.actionsGrid}>
            {(['pending', 'processing', 'shipped', 'delivered'] as OrderStatus[]).map((newStatus) => (
              <Pressable
                key={newStatus}
                style={[
                  styles.statusButton,
                  {
                    backgroundColor: status === newStatus ? STATUS_COLORS[newStatus] : colors.border,
                  },
                ]}
                onPress={() => handleStatusChange(newStatus)}
              >
                <Text
                  style={[
                    styles.statusButtonText,
                    {
                      color: status === newStatus ? '#FFFFFF' : colors.textSecondary,
                    },
                  ]}
                >
                  {newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderNumber: {
    fontSize: 20,
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
  dateText: {
    fontSize: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    flex: 1,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
  },
  itemQuantity: {
    fontSize: 12,
    marginTop: 4,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '700',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusButton: {
    width: '48%',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  statusButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
