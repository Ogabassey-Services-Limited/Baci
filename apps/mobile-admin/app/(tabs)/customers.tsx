/**
 * Customers Screen - Customer Management
 * View customer list and details with real-time data
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useCustomers, useCustomerStats, type Customer } from '@/hooks/useCustomers';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/constants/theme';
import { useFailedOrders, type FailedOrder } from '@/hooks/useFailedOrders';
import * as Linking from 'expo-linking';

export default function CustomersScreen() {
  const { colors, shadows, isDark } = useTheme();
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState<'all' | 'failed'>('failed');

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useCustomers();

  const { data: failedOrders, isLoading: isLoadingFailed, refetch: refetchFailed } = useFailedOrders();

  const { data: stats } = useCustomerStats();

  // Flatten pages into single array
  const customers = useMemo(() => {
    return data?.pages.flatMap((page) => page.customers) ?? [];
  }, [data]);

  const handleLoadMore = useCallback(() => {
    if (activeTab === 'all' && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [activeTab, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `₦${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `₦${(amount / 1000).toFixed(0)}k`;
    }
    return `₦${amount.toLocaleString()}`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getDisplayName = (customer: Customer) => {
    if (customer.full_name) return customer.full_name;
    if (customer.first_name || customer.last_name) {
      return `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim();
    }
    return customer.email.split('@')[0];
  };

  const handleWhatsApp = (phone: string) => {
    // Remove '+' and any non-numeric characters for WhatsApp API
    const cleanPhone = phone.replace(/\D/g, '');
    Linking.openURL(`https://wa.me/${cleanPhone}`);
  };

  /* Sanitize phone for calling - keep + for international numbers */
  const handleCall = (phone: string) => {
    // Keep only digits and +
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    Linking.openURL(`tel:${cleanPhone}`);
  };

  const handleEmail = (email: string) => {
    Linking.openURL(`mailto:${email}`);
  };

  /* ... */

  const renderFailedOrder = ({ item }: { item: FailedOrder }) => {
    // Determine error message based on gateway response or status
    const errorMessage = item.gateway_response?.message ||
      (item.payment_status === 'bnpl_pending' ? 'BNPL Drop-off' : 'Payment Failed');

    const displayName = item.customer_name || 'Guest';

    return (
      <Pressable
        style={({ pressed }) => [
          styles.customerCard,
          { backgroundColor: colors.card },
          shadows.sm,
          pressed && { backgroundColor: colors.cardHover },
        ]}
        onPress={() => router.push(`/order/${item.id}`)}
      >
        <View style={[styles.avatar, { backgroundColor: colors.goldLight }]}>
          <Text style={[styles.avatarText, { color: colors.gold }]}>{getInitials(displayName)}</Text>
        </View>

        <View style={styles.customerInfo}>
          <Text style={[styles.customerName, { color: colors.text }]} numberOfLines={1}>{displayName}</Text>
          <Text style={[styles.customerEmail, { color: colors.textSecondary }]} numberOfLines={1}>{item.customer_email}</Text>

          <Text style={[styles.errorText, { color: '#EF4444' }]} numberOfLines={1}>
            {formatCurrency(item.total)} • {errorMessage}
          </Text>
        </View>

        <View style={styles.actionRow}>
          {item.customer_phone && (
            <>
              <Pressable
                style={[styles.miniActionButton, { backgroundColor: '#DCFCE7' }]}
                onPress={(e) => {
                  e.stopPropagation();
                  handleWhatsApp(item.customer_phone!);
                }}
              >
                <Ionicons name="logo-whatsapp" size={16} color="#16A34A" />
              </Pressable>
              <Pressable
                style={[styles.miniActionButton, { backgroundColor: '#F3F4F6' }]}
                onPress={(e) => {
                  e.stopPropagation();
                  handleCall(item.customer_phone!);
                }}
              >
                <Ionicons name="call" size={16} color="#4B5563" />
              </Pressable>
            </>
          )}
          <Pressable
            style={[styles.miniActionButton, { backgroundColor: '#DBEAFE' }]}
            onPress={(e) => {
              e.stopPropagation();
              handleEmail(item.customer_email);
            }}
          >
            <Ionicons name="mail" size={16} color="#2563EB" />
          </Pressable>
        </View>
      </Pressable>
    );
  };

  const renderCustomer = ({ item }: { item: Customer }) => {
    const displayName = getDisplayName(item);

    return (
      <Pressable
        style={({ pressed }) => [
          styles.customerCard,
          { backgroundColor: colors.card },
          shadows.sm,
          pressed && { backgroundColor: colors.cardHover },
        ]}
        onPress={() => router.push(`/customer/${item.id}`)}
      >
        <View style={[styles.avatar, { backgroundColor: colors.primaryLight }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>{getInitials(displayName)}</Text>
        </View>

        <View style={styles.customerInfo}>
          <Text style={[styles.customerName, { color: colors.text }]} numberOfLines={1}>{displayName}</Text>
          <Text style={[styles.customerEmail, { color: colors.textSecondary }]} numberOfLines={1}>{item.email}</Text>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Ionicons name="cart-outline" size={14} color={colors.textMuted} />
              <Text style={[styles.statText, { color: colors.textMuted }]}>{item.total_orders} orders</Text>
            </View>
            <Text style={[styles.statDot, { color: colors.textMuted }]}>•</Text>
            <View style={styles.stat}>
              <Text style={[styles.statText, { color: colors.success }]}>{formatCurrency(item.total_spent)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.actionRow}>
          {item.phone && (
            <>
              <Pressable
                style={[styles.miniActionButton, { backgroundColor: '#DCFCE7' }]}
                onPress={(e) => {
                  e.stopPropagation();
                  handleWhatsApp(item.phone!);
                }}
              >
                <Ionicons name="logo-whatsapp" size={16} color="#16A34A" />
              </Pressable>
              <Pressable
                style={[styles.miniActionButton, { backgroundColor: '#F3F4F6' }]}
                onPress={(e) => {
                  e.stopPropagation();
                  handleCall(item.phone!);
                }}
              >
                <Ionicons name="call" size={16} color="#4B5563" />
              </Pressable>
            </>
          )}
          <Pressable
            style={[styles.miniActionButton, { backgroundColor: '#DBEAFE' }]}
            onPress={(e) => {
              e.stopPropagation();
              handleEmail(item.email);
            }}
          >
            <Ionicons name="mail" size={16} color="#2563EB" />
          </Pressable>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Customers</Text>
        <Pressable style={[styles.searchButton, { backgroundColor: colors.card }]}>
          <Ionicons name="search" size={22} color={colors.text} />
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <Pressable
          style={[
            styles.tab,
            activeTab === 'failed' && { backgroundColor: colors.gold, borderColor: colors.gold }
          ]}
          onPress={() => setActiveTab('failed')}
        >
          <Text style={[
            styles.tabText,
            activeTab === 'failed' ? { color: '#FFF' } : { color: colors.textSecondary }
          ]}>Follow Up {failedOrders?.length ? `(${failedOrders.length})` : ''}</Text>
        </Pressable>
        <Pressable
          style={[
            styles.tab,
            activeTab === 'all' && { backgroundColor: colors.gold, borderColor: colors.gold }
          ]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[
            styles.tabText,
            activeTab === 'all' ? { color: '#FFF' } : { color: colors.textSecondary }
          ]}>All Customers</Text>
        </Pressable>
      </View>

      {activeTab === 'all' ? (
        <>
          {/* Stats Summary - Only for All Customers */}
          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, { backgroundColor: colors.card }, shadows.sm]}>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{stats?.total ?? 0}</Text>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: colors.card }, shadows.sm]}>
              <Text style={[styles.summaryValue, { color: colors.success }]}>{stats?.newThisWeek ?? 0}</Text>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>New</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: colors.card }, shadows.sm]}>
              <Text style={[styles.summaryValue, { color: colors.gold }]}>{stats?.retentionRate ?? 0}%</Text>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Returning</Text>
            </View>
          </View>

          {/* Customers List */}
          <FlatList
            data={customers}
            renderItem={renderCustomer}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={isLoading}
                onRefresh={refetch}
                tintColor={colors.gold}
                colors={[colors.gold]}
              />
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              isFetchingNextPage ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator color={colors.gold} />
                </View>
              ) : null
            }
            ListEmptyComponent={
              !isLoading ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="people-outline" size={56} color={colors.textMuted} />
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>No customers yet</Text>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Customers will appear here after their first purchase</Text>
                </View>
              ) : null
            }
            showsVerticalScrollIndicator={false}
          />
        </>
      ) : (
        /* Failed Transactions List */
        <FlatList
          data={failedOrders}
          renderItem={renderFailedOrder}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isLoadingFailed}
              onRefresh={refetchFailed}
              tintColor={colors.gold}
              colors={[colors.gold]}
            />
          }
          ListEmptyComponent={
            !isLoadingFailed ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="checkmark-circle-outline" size={56} color={colors.success} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No issues</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>All recent transactions are successful!</Text>
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  title: {
    fontSize: TYPOGRAPHY.size['3xl'],
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'transparent', // Default transparent border
  },
  tabText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  summaryCard: {
    flex: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  summaryLabel: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  listContent: {
    padding: SPACING.lg,
    paddingTop: 0,
    gap: SPACING.md,
  },
  customerCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  avatarText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  customerInfo: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  customerName: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  customerEmail: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginBottom: 4,
  },
  errorText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  statDot: {
    fontSize: TYPOGRAPHY.size.xs,
  },
  rightSection: {
    alignItems: 'flex-end',
    gap: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniActionButton: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lastOrder: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: SPACING.sm,
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    marginTop: SPACING.md,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    textAlign: 'center',
  },
  footerLoader: {
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
});
