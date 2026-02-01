/**
 * Customers Screen - Customer Management
 * View customer list and details with real-time data
 */

import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React, { memo, useCallback, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import {
  type Customer,
  useCustomerStats,
  useCustomers,
} from '@/hooks/useCustomers';
import { type FailedOrder, useFailedOrders } from '@/hooks/useFailedOrders';
import { useTheme } from '@/hooks/useTheme';

// Item height for getItemLayout optimization (card padding + content + gap)
const CUSTOMER_ITEM_HEIGHT = 88;

// Helper functions moved outside component to prevent recreation
const formatCurrency = (amount: number) => {
  if (amount >= 1000000) {
    return `₦${(amount / 1000000).toFixed(1)} M`;
  }
  if (amount >= 1000) {
    return `₦${(amount / 1000).toFixed(0)} k`;
  }
  return `₦${amount.toLocaleString()} `;
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
  const names = [customer.first_name, customer.last_name]
    .filter((name): name is string => Boolean(name))
    .join(' ');
  if (names) return names;
  return customer.email.split('@')[0];
};

const handleWhatsApp = (phone: string) => {
  const cleanPhone = phone.replace(/\D/g, '');
  Linking.openURL(`https://wa.me/${cleanPhone}`);
};

const handleCall = (phone: string) => {
  const cleanPhone = phone.replace(/[^\d+]/g, '');
  Linking.openURL(`tel:${cleanPhone}`);
};

const handleEmail = (email: string) => {
  Linking.openURL(`mailto:${email}`);
};

// Memoized Failed Order Item component
interface FailedOrderItemProps {
  item: FailedOrder;
  colors: ReturnType<typeof useTheme>['colors'];
  shadows: ReturnType<typeof useTheme>['shadows'];
  onPress: (item: FailedOrder) => void;
}

const FailedOrderItem = memo(function FailedOrderItem({
  item,
  colors,
  shadows,
  onPress,
}: FailedOrderItemProps) {
  const errorMessage =
    item.gateway_response?.message ||
    (item.payment_status === 'bnpl_pending'
      ? 'BNPL Drop-off'
      : 'Payment Failed');

  const displayName = item.customer_name || 'Guest';

  return (
    <Pressable
      style={({ pressed }) => [
        styles.customerCard,
        { backgroundColor: colors.card, minHeight: 56 },
        shadows.sm,
        pressed && { backgroundColor: colors.cardHover },
      ]}
      onPress={() => onPress(item)}
      accessibilityLabel={`Follow up: ${displayName}, ${item.customer_email}, ${formatCurrency(item.total)}, ${errorMessage}`}
      accessibilityRole="button"
      accessibilityHint="View customer or order details"
    >
      <View style={[styles.avatar, { backgroundColor: colors.goldLight }]}>
        <Text style={[styles.avatarText, { color: colors.gold }]}>
          {getInitials(displayName)}
        </Text>
      </View>

      <View style={styles.customerInfo}>
        <Text
          style={[styles.customerName, { color: colors.text }]}
          numberOfLines={1}
        >
          {displayName}
        </Text>
        <Text
          style={[styles.customerEmail, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {item.customer_email}
        </Text>

        <Text style={[styles.errorText, { color: '#EF4444' }]} numberOfLines={1}>
          {formatCurrency(item.total)} •{' '}
          {item.attempt_count > 1
            ? `${item.attempt_count} attempts`
            : errorMessage}
        </Text>
      </View>

      <View style={styles.actionRow}>
        {item.customer_phone && (
          <>
            <Pressable
              style={[styles.miniActionButton, { backgroundColor: '#DCFCE7', minWidth: 44, minHeight: 44 }]}
              onPress={(e) => {
                e.stopPropagation();
                handleWhatsApp(item.customer_phone!);
              }}
              accessibilityLabel={`Message ${displayName} on WhatsApp`}
              accessibilityRole="button"
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons name="logo-whatsapp" size={16} color="#16A34A" />
            </Pressable>
            <Pressable
              style={[styles.miniActionButton, { backgroundColor: '#F3F4F6', minWidth: 44, minHeight: 44 }]}
              onPress={(e) => {
                e.stopPropagation();
                handleCall(item.customer_phone!);
              }}
              accessibilityLabel={`Call ${displayName}`}
              accessibilityRole="button"
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons name="call" size={16} color="#4B5563" />
            </Pressable>
          </>
        )}
        <Pressable
          style={[styles.miniActionButton, { backgroundColor: '#DBEAFE', minWidth: 44, minHeight: 44 }]}
          onPress={(e) => {
            e.stopPropagation();
            handleEmail(item.customer_email);
          }}
          accessibilityLabel={`Email ${displayName}`}
          accessibilityRole="button"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons name="mail" size={16} color="#2563EB" />
        </Pressable>
      </View>
    </Pressable>
  );
});

// Memoized Customer Item component
interface CustomerItemProps {
  item: Customer;
  colors: ReturnType<typeof useTheme>['colors'];
  shadows: ReturnType<typeof useTheme>['shadows'];
  onPress: (id: string) => void;
}

const CustomerItem = memo(function CustomerItem({
  item,
  colors,
  shadows,
  onPress,
}: CustomerItemProps) {
  const displayName = getDisplayName(item);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.customerCard,
        { backgroundColor: colors.card, minHeight: 56 },
        shadows.sm,
        pressed && { backgroundColor: colors.cardHover },
      ]}
      onPress={() => onPress(item.id)}
      accessibilityLabel={`${displayName}, ${item.email}, ${item.total_orders} orders, spent ${formatCurrency(item.total_spent)}`}
      accessibilityRole="button"
      accessibilityHint="View customer details"
    >
      <View style={[styles.avatar, { backgroundColor: colors.primaryLight }]}>
        <Text style={[styles.avatarText, { color: colors.primary }]}>
          {getInitials(displayName)}
        </Text>
      </View>

      <View style={styles.customerInfo}>
        <Text
          style={[styles.customerName, { color: colors.text }]}
          numberOfLines={1}
        >
          {displayName}
        </Text>
        <Text
          style={[styles.customerEmail, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {item.email}
        </Text>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Ionicons name="cart-outline" size={14} color={colors.textMuted} />
            <Text style={[styles.statText, { color: colors.textMuted }]}>
              {item.total_orders} orders
            </Text>
          </View>
          <Text style={[styles.statDot, { color: colors.textMuted }]}>•</Text>
          <View style={styles.stat}>
            <Text style={[styles.statText, { color: colors.success }]}>
              {formatCurrency(item.total_spent)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.actionRow}>
        {item.phone && (
          <>
            <Pressable
              style={[styles.miniActionButton, { backgroundColor: '#DCFCE7', minWidth: 44, minHeight: 44 }]}
              onPress={(e) => {
                e.stopPropagation();
                handleWhatsApp(item.phone!);
              }}
              accessibilityLabel={`Message ${displayName} on WhatsApp`}
              accessibilityRole="button"
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons name="logo-whatsapp" size={16} color="#16A34A" />
            </Pressable>
            <Pressable
              style={[styles.miniActionButton, { backgroundColor: '#F3F4F6', minWidth: 44, minHeight: 44 }]}
              onPress={(e) => {
                e.stopPropagation();
                handleCall(item.phone!);
              }}
              accessibilityLabel={`Call ${displayName}`}
              accessibilityRole="button"
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons name="call" size={16} color="#4B5563" />
            </Pressable>
          </>
        )}
        <Pressable
          style={[styles.miniActionButton, { backgroundColor: '#DBEAFE', minWidth: 44, minHeight: 44 }]}
          onPress={(e) => {
            e.stopPropagation();
            handleEmail(item.email);
          }}
          accessibilityLabel={`Email ${displayName}`}
          accessibilityRole="button"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons name="mail" size={16} color="#2563EB" />
        </Pressable>
      </View>
    </Pressable>
  );
});

export default function CustomersScreen() {
  const { colors, shadows, isDark } = useTheme();
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState<'all' | 'failed'>('failed');
  const [searchQuery, setSearchQuery] = React.useState('');

  // Collapsible search bar animation
  // Using opacity and translateY for native driver support (better performance)
  const searchBarAnim = useRef(new Animated.Value(1)).current;
  const lastScrollY = useRef(0);
  const isSearchVisible = useRef(true);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentScrollY = event.nativeEvent.contentOffset.y;
      const diff = currentScrollY - lastScrollY.current;

      // Only trigger animation if scrolled more than 10px and not at top
      if (Math.abs(diff) > 10) {
        if (diff > 0 && isSearchVisible.current && currentScrollY > 50) {
          // Scrolling down - hide search bar
          isSearchVisible.current = false;
          Animated.timing(searchBarAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start();
        } else if (diff < 0 && !isSearchVisible.current) {
          // Scrolling up - show search bar
          isSearchVisible.current = true;
          Animated.timing(searchBarAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }).start();
        }
      }

      lastScrollY.current = currentScrollY;
    },
    [searchBarAnim]
  );

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useCustomers();

  const {
    data: failedOrders,
    isLoading: isLoadingFailed,
    refetch: refetchFailed,
  } = useFailedOrders();

  const { data: stats } = useCustomerStats();

  // Flatten pages into single array and filter by search
  const customers = useMemo(() => {
    const allCustomers = data?.pages.flatMap((page) => page.customers) ?? [];
    if (!searchQuery.trim()) return allCustomers;
    const q = searchQuery.toLowerCase();
    return allCustomers.filter(
      (c) =>
        c.first_name?.toLowerCase().includes(q) ||
        c.last_name?.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
    );
  }, [data, searchQuery]);

  // Filter failed orders by search
  const filteredFailedOrders = useMemo(() => {
    if (!failedOrders) return [];
    if (!searchQuery.trim()) return failedOrders;
    const q = searchQuery.toLowerCase();
    return failedOrders.filter(
      (o) =>
        o.customer_name?.toLowerCase().includes(q) ||
        o.customer_email.toLowerCase().includes(q)
    );
  }, [failedOrders, searchQuery]);

  const handleLoadMore = useCallback(() => {
    if (activeTab === 'all' && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [activeTab, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Navigation callbacks for memoized list items
  const handleCustomerPress = useCallback(
    (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.push(`/customer/${id}` as any);
    },
    [router]
  );

  const handleFailedOrderPress = useCallback(
    (item: FailedOrder) => {
      if (item.customer_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        router.push(`/customer/${item.customer_id}` as any);
      } else {
        router.push(`/order/${item.id}`);
      }
    },
    [router]
  );

  // Memoized renderItem callbacks
  const renderCustomer = useCallback(
    ({ item }: ListRenderItemInfo<Customer>) => (
      <CustomerItem
        item={item}
        colors={colors}
        shadows={shadows}
        onPress={handleCustomerPress}
      />
    ),
    [colors, shadows, handleCustomerPress]
  );

  const renderFailedOrder = useCallback(
    ({ item }: ListRenderItemInfo<FailedOrder>) => (
      <FailedOrderItem
        item={item}
        colors={colors}
        shadows={shadows}
        onPress={handleFailedOrderPress}
      />
    ),
    [colors, shadows, handleFailedOrderPress]
  );

  // Memoized keyExtractor callbacks
  const customerKeyExtractor = useCallback(
    (item: Customer) => item.id,
    []
  );

  const failedOrderKeyExtractor = useCallback(
    (item: FailedOrder) => item.id,
    []
  );

  // getItemLayout for consistent item heights (improves scroll performance)
  const getItemLayout = useCallback(
    (_data: ArrayLike<Customer | FailedOrder> | null | undefined, index: number) => ({
      length: CUSTOMER_ITEM_HEIGHT,
      offset: CUSTOMER_ITEM_HEIGHT * index,
      index,
    }),
    []
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Customers</Text>
      </View>

      {/* Collapsible Search Bar */}
      <Animated.View
        style={[
          styles.searchContainer,
          {
            opacity: searchBarAnim,
            transform: [
              {
                translateY: searchBarAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-60, 0],
                }),
              },
              {
                scaleY: searchBarAnim,
              },
            ],
          },
        ]}
      >
        <View style={[styles.searchBar, { backgroundColor: colors.card }]}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search customers..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <Pressable
              onPress={() => setSearchQuery('')}
              accessibilityLabel="Clear search"
              accessibilityRole="button"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}
            >
              <Ionicons
                name="close-circle"
                size={20}
                color={colors.textMuted}
              />
            </Pressable>
          )}
        </View>
      </Animated.View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <Pressable
          style={[
            styles.tab,
            { minHeight: 44 },
            activeTab === 'failed' && {
              backgroundColor: colors.gold,
              borderColor: colors.gold,
            },
          ]}
          onPress={() => setActiveTab('failed')}
          accessibilityLabel={`Follow Up${failedOrders?.length ? `: ${failedOrders.length} customers` : ''}${activeTab === 'failed' ? ', currently selected' : ''}`}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'failed' }}
          accessibilityHint="View customers with failed transactions"
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'failed'
                ? { color: '#FFF' }
                : { color: colors.textSecondary },
            ]}
          >
            Follow Up {failedOrders?.length ? `(${failedOrders.length})` : ''}
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.tab,
            { minHeight: 44 },
            activeTab === 'all' && {
              backgroundColor: colors.gold,
              borderColor: colors.gold,
            },
          ]}
          onPress={() => setActiveTab('all')}
          accessibilityLabel={`All Customers${activeTab === 'all' ? ', currently selected' : ''}`}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'all' }}
          accessibilityHint="View all customers"
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'all'
                ? { color: '#FFF' }
                : { color: colors.textSecondary },
            ]}
          >
            All Customers
          </Text>
        </Pressable>
      </View>

      {activeTab === 'all' ? (
        <>
          {/* Stats Summary - Only for All Customers */}
          <View style={styles.summaryRow}>
            <View
              style={[
                styles.summaryCard,
                { backgroundColor: colors.card },
                shadows.sm,
              ]}
            >
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {stats?.total ?? 0}
              </Text>
              <Text
                style={[styles.summaryLabel, { color: colors.textSecondary }]}
              >
                Total
              </Text>
            </View>
            <View
              style={[
                styles.summaryCard,
                { backgroundColor: colors.card },
                shadows.sm,
              ]}
            >
              <Text style={[styles.summaryValue, { color: colors.success }]}>
                {stats?.newThisWeek ?? 0}
              </Text>
              <Text
                style={[styles.summaryLabel, { color: colors.textSecondary }]}
              >
                New
              </Text>
            </View>
            <View
              style={[
                styles.summaryCard,
                { backgroundColor: colors.card },
                shadows.sm,
              ]}
            >
              <Text style={[styles.summaryValue, { color: colors.gold }]}>
                {stats?.retentionRate ?? 0}%
              </Text>
              <Text
                style={[styles.summaryLabel, { color: colors.textSecondary }]}
              >
                Returning
              </Text>
            </View>
          </View>

          {/* Customers List */}
          <FlatList
            data={customers}
            renderItem={renderCustomer}
            keyExtractor={customerKeyExtractor}
            getItemLayout={getItemLayout}
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
            onScroll={handleScroll}
            scrollEventThrottle={16}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            windowSize={5}
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
                  <Ionicons
                    name="people-outline"
                    size={56}
                    color={colors.textMuted}
                  />
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>
                    No customers yet
                  </Text>
                  <Text
                    style={[styles.emptyText, { color: colors.textSecondary }]}
                  >
                    Customers will appear here after their first purchase
                  </Text>
                </View>
              ) : null
            }
            showsVerticalScrollIndicator={false}
          />
        </>
      ) : (
        /* Failed Transactions List */
        <FlatList
          data={filteredFailedOrders}
          renderItem={renderFailedOrder}
          keyExtractor={failedOrderKeyExtractor}
          getItemLayout={getItemLayout}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={5}
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
                <Ionicons
                  name="checkmark-circle-outline"
                  size={56}
                  color={colors.success}
                />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  No issues
                </Text>
                <Text
                  style={[styles.emptyText, { color: colors.textSecondary }]}
                >
                  All recent transactions are successful!
                </Text>
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
  searchContainer: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.lg,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    paddingVertical: SPACING.xs,
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
