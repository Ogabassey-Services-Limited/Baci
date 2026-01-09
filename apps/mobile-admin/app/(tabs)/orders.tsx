/**
 * Orders Screen - Order Management Dashboard
 * Real-time order management with status updates
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns';
import OrderReportModal from '@/components/ui/OrderReportModal';
import { exportOrdersRPC } from '@/utils/export-orders';
import DateRangePicker from '@/components/ui/DateRangePicker';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  StatusBar,
  ActivityIndicator,
  TextInput,
  Modal,
  Animated,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useMerchant } from '@/hooks/useMerchant';
import { useOrders, useUpdateOrderStatus, type Order } from '@/hooks/useOrders';
import { useOrderCounts } from '@/hooks/useOrderCounts';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/constants/theme';
import { BaciLogo } from '@/components/BaciLogo';
// Shared types and constants from monorepo
import {
  type ShippingStatus,
  type PaymentStatus,
  SHIPPING_STATUS_CONFIG,
  PAYMENT_STATUS_CONFIG,
  SHIPPING_STATUS_ACTIONS,
  ORDER_SOURCE_CONFIG,
  BRAND_COLORS,
} from '@baci/shared';

export default function OrdersScreen() {
  const { colors, shadows, isDark } = useTheme();
  const { storeUrl, merchant } = useMerchant();
  const [statusFilter, setStatusFilter] = useState<ShippingStatus | undefined>(undefined);
  const [showInsight, setShowInsight] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [dateRange, setDateRange] = useState<string | { start: Date | null; end: Date | null } | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });

  // Status update mutation
  const updateStatus = useUpdateOrderStatus();

  // Collapsible search bar animation
  const searchBarHeight = useRef(new Animated.Value(1)).current;
  const lastScrollY = useRef(0);
  const isSearchVisible = useRef(true);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const diff = currentScrollY - lastScrollY.current;

    // Only trigger animation if scrolled more than 10px and not at top
    if (Math.abs(diff) > 10) {
      if (diff > 0 && isSearchVisible.current && currentScrollY > 50) {
        // Scrolling down - hide search bar
        isSearchVisible.current = false;
        Animated.timing(searchBarHeight, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }).start();
      } else if (diff < 0 && !isSearchVisible.current) {
        // Scrolling up - show search bar
        isSearchVisible.current = true;
        Animated.timing(searchBarHeight, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false,
        }).start();
      }
    }

    lastScrollY.current = currentScrollY;
  }, [searchBarHeight]);

  // Fetch orders with filter
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useOrders(statusFilter || 'all', searchQuery, dateRange);

  // Flatten pages into single array
  const allOrders = useMemo(() => {
    return data?.pages.flatMap((page) => page.orders) ?? [];
  }, [data]);

  const orders = allOrders;

  const pendingCount = counts?.pending ?? 0;

  // Fetch order counts
  const { data: counts } = useOrderCounts();

  // Format date range for display
  const clearDateRange = () => {
    setDateRange(null);
  };

  const dateRangeLabel = useMemo(() => {
    if (typeof dateRange === 'string') return dateRange;
    if (dateRange?.start && dateRange?.end) {
      return `${format(dateRange.start, 'MMM d, yyyy')} - ${format(dateRange.end, 'MMM d, yyyy')}`;
    }
    return 'All Time';
  }, [dateRange]);

  const handleExport = async () => {
    if (allOrders.length === 0) return;
    await exportOrdersRPC(allOrders);
  };

  // Map color key from shared config to actual theme color
  const getColorFromKey = (colorKey: string): string => {
    const colorMap: Record<string, string> = {
      pending: colors.pending,
      processing: colors.processing,
      shipped: colors.shipped,
      delivered: colors.delivered,
      cancelled: colors.cancelled,
      returned: colors.returned || colors.textMuted,
      success: colors.success,
      error: colors.error,
      warning: colors.warning,
      info: colors.info || colors.primary,
      textMuted: colors.textMuted,
      primary: colors.primary,
      gold: colors.gold,
      whatsapp: BRAND_COLORS.whatsapp,
      instagram: BRAND_COLORS.instagram,
    };
    return colorMap[colorKey] ?? colors.textMuted;
  };

  // Get available status actions based on current status (from shared config)
  const getStatusActions = (currentStatus: ShippingStatus): { status: ShippingStatus; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] => {
    const normalizedStatus = currentStatus === 'fulfilled' ? 'pending' : currentStatus;
    const actions = SHIPPING_STATUS_ACTIONS[normalizedStatus as ShippingStatus] ?? [];
    return actions.map((action) => ({
      status: action.nextStatus,
      label: action.label,
      icon: action.icon as keyof typeof Ionicons.glyphMap,
      color: getColorFromKey(SHIPPING_STATUS_CONFIG[action.nextStatus]?.colorKey ?? 'textMuted'),
    }));
  };

  // Handle status update
  const handleStatusUpdate = async (newStatus: ShippingStatus) => {
    if (!selectedOrder) return;

    // CRITICAL: Check payment status before allowing transition to processing
    // Unpaid orders must either be paid or explicitly shipped on credit
    if (newStatus === 'processing' && selectedOrder.payment_status !== 'paid' && !selectedOrder.is_credit_order) {
      setShowStatusDropdown(false);
      Alert.alert(
        'Payment Required',
        `This order (${selectedOrder.order_number}) hasn't been paid yet. What would you like to do?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Record Payment',
            onPress: () => {
              setSelectedOrder(null);
              // Navigate to order with action hint to open payment modal
              router.push(`/order/${selectedOrder.id}?action=record-payment`);
            },
          },
          {
            text: 'Ship on Credit',
            style: 'destructive',
            onPress: () => {
              setSelectedOrder(null);
              // Navigate to order with action hint to open credit modal
              router.push(`/order/${selectedOrder.id}?action=ship-on-credit`);
            },
          },
        ]
      );
      return;
    }

    try {
      await updateStatus.mutateAsync({ orderId: selectedOrder.id, status: newStatus });
      setShowStatusDropdown(false);
      setSelectedOrder(null);
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  // Open status dropdown for an order
  const openStatusDropdown = (order: Order, event: any) => {
    // Get the position of the pressed element
    event.target.measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
      setDropdownPosition({ x: pageX - 100, y: pageY + height + 4 });
      setSelectedOrder(order);
      setShowStatusDropdown(true);
    });
  };

  // Close dropdown
  const closeStatusDropdown = () => {
    setShowStatusDropdown(false);
    setSelectedOrder(null);
  };

  // Get shipping status display config (using shared config + theme colors)
  const getShippingStatusConfig = (status: ShippingStatus) => {
    const config = SHIPPING_STATUS_CONFIG[status] ?? SHIPPING_STATUS_CONFIG.pending;
    return {
      color: getColorFromKey(config.colorKey),
      label: config.label,
    };
  };

  // Get payment status display config (using shared config + theme colors)
  const getPaymentStatusConfig = (status: PaymentStatus) => {
    const config = PAYMENT_STATUS_CONFIG[status] ?? PAYMENT_STATUS_CONFIG.pending;
    return {
      color: getColorFromKey(config.colorKey),
      label: config.label,
    };
  };

  // Source icon config (using shared config + theme colors)
  const getSourceConfig = (source: string | null) => {
    if (!source) return { icon: 'globe-outline' as const, color: colors.textSecondary, label: 'Website' };

    const normalizedSource = source.toLowerCase().trim();

    switch (normalizedSource) {
      // --- Social Media ---
      case 'instagram':
        return { icon: 'logo-instagram' as const, color: '#C13584', label: 'Instagram' };
      case 'whatsapp':
        return { icon: 'logo-whatsapp' as const, color: '#25D366', label: 'WhatsApp' };
      case 'facebook':
        return { icon: 'logo-facebook' as const, color: '#1877F2', label: 'Facebook' };
      case 'twitter':
      case 'x':
        return { icon: 'logo-twitter' as const, color: '#1DA1F2', label: 'Twitter' };
      case 'tiktok':
        return { icon: 'logo-tiktok' as const, color: '#000000', label: 'TikTok' };
      case 'snapchat':
        return { icon: 'logo-snapchat' as const, color: '#FFFC00', label: 'Snapchat' };
      case 'youtube':
        return { icon: 'logo-youtube' as const, color: '#FF0000', label: 'YouTube' };
      case 'pinterest':
        return { icon: 'logo-pinterest' as const, color: '#BD081C', label: 'Pinterest' };
      case 'linkedin':
        return { icon: 'logo-linkedin' as const, color: '#0A66C2', label: 'LinkedIn' };
      case 'telegram':
        // 'logo-telegram' exists in newer Ionicons, fallback to 'send' if issue
        return { icon: 'paper-plane' as const, color: '#0088CC', label: 'Telegram' };

      // --- Marketplaces ---
      case 'amazon':
        return { icon: 'logo-amazon' as const, color: '#FF9900', label: 'Amazon' };
      case 'jumia':
        return { icon: 'cart' as const, color: '#FF9900', label: 'Jumia' };
      case 'konga':
        return { icon: 'cart' as const, color: '#ED017F', label: 'Konga' };
      case 'jiji':
        return { icon: 'cart' as const, color: '#3DBE29', label: 'Jiji' };

      // --- System ---
      case 'mobile_app':
        return { icon: 'phone-portrait-outline' as const, color: colors.primary, label: 'Mobile App' };
      case 'online_store':
      case 'website':
      case 'storefront':
        return { icon: 'globe-outline' as const, color: colors.info || colors.textSecondary, label: 'Website' };
      case 'pos':
        return { icon: 'calculator-outline' as const, color: colors.success, label: 'POS' };
      case 'physical':
        return { icon: 'storefront-outline' as const, color: colors.gold, label: 'Store' };
      case 'staff_entry':
        return { icon: 'person-outline' as const, color: colors.textSecondary, label: 'Staff' };

      // --- Custom/Fallback ---
      default:
        // Capitalize first letter for display
        const label = source.charAt(0).toUpperCase() + source.slice(1);
        return {
          icon: 'pricetag-outline' as const,
          color: colors.textSecondary,
          label: label,
        };
    }
  };

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

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

  const renderOrder = ({ item }: { item: Order }) => {
    const shippingConfig = getShippingStatusConfig(item.shipping_status as ShippingStatus);
    const paymentConfig = getPaymentStatusConfig(item.payment_status as PaymentStatus);
    const sourceConfig = getSourceConfig(item.source);

    return (
      <Pressable
        style={({ pressed }) => [
          styles.orderCard,
          { backgroundColor: colors.card },
          shadows.sm,
          pressed && { backgroundColor: colors.cardHover },
        ]}
        onPress={() => router.push(`/order/${item.id}`)}
      >
        <View style={styles.orderHeader}>
          <View style={styles.orderNumberRow}>
            {/* Source Icon */}
            <View style={[styles.sourceIcon, { backgroundColor: sourceConfig.color + '15' }]}>
              <Ionicons name={sourceConfig.icon} size={16} color={sourceConfig.color} />
            </View>
            <Text style={[styles.customerName, { color: colors.text }]}>{item.customer_name}</Text>
          </View>
          <View style={styles.statusBadges}>
            {/* Payment Status Badge */}
            <View style={[styles.paymentBadge, { backgroundColor: paymentConfig.color + '20' }]}>
              <Text style={[styles.paymentText, { color: paymentConfig.color }]}>
                {paymentConfig.label}
              </Text>
            </View>
            {/* Shipping Status Badge - Tappable */}
            <Pressable
              style={[styles.statusBadge, { backgroundColor: shippingConfig.color + '20' }]}
              onPress={(e) => {
                e.stopPropagation();
                openStatusDropdown(item, e);
              }}
              hitSlop={8}
            >
              <View style={[styles.statusDot, { backgroundColor: shippingConfig.color }]} />
              <Text style={[styles.statusText, { color: shippingConfig.color }]}>
                {shippingConfig.label}
              </Text>
              <Ionicons name="chevron-down" size={12} color={shippingConfig.color} />
            </Pressable>
          </View>
        </View>

        <Text style={[styles.orderNumber, { color: colors.textSecondary }]}>{item.order_number}</Text>

        <View style={styles.orderFooter}>
          <Text style={[styles.orderTotal, { color: colors.text }]}>{formatPrice(item.total)}</Text>
          <View style={styles.orderMetaRow}>
            <Text style={[styles.orderMetaBold, { color: colors.textSecondary }]}>
              {item.item_count ?? 0} {(item.item_count ?? 0) === 1 ? 'item' : 'items'}
            </Text>
            <Text style={[styles.orderMetaDot, { color: colors.textMuted }]}>•</Text>
            <Text style={[styles.orderMeta, { color: colors.textMuted }]}>
              {formatTime(item.created_at)}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  };

  const FilterTab = ({ status, label }: { status: ShippingStatus | 'all'; label: string }) => {
    const isActive = (status === 'all' && !statusFilter) || statusFilter === status;
    const count = counts ? (status === 'all' ? counts.all : counts[status] ?? 0) : 0;

    return (
      <Pressable
        style={[
          styles.filterTab,
          { backgroundColor: isActive ? colors.gold : colors.card },
        ]}
        onPress={() => setStatusFilter(status === 'all' ? undefined : status as ShippingStatus)}
      >
        <Text style={[
          styles.filterText,
          { color: isActive ? '#000000' : colors.textSecondary },
        ]}>
          {label} ({count})
        </Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Orders</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            style={[styles.calendarButton, { backgroundColor: colors.card }]}
            onPress={() => setShowReportModal(true)}
          >
            <Ionicons
              name="document-text-outline"
              size={22}
              color={colors.primary}
            />
          </Pressable>
          <Pressable
            style={[styles.calendarButton, { backgroundColor: colors.card }]}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons
              name="calendar-outline"
              size={22}
              color={colors.primary}
            />
          </Pressable>
        </View>
      </View>

      {/* Collapsible Search Bar */}
      <Animated.View
        style={[
          styles.searchContainer,
          {
            maxHeight: searchBarHeight.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 60],
            }),
            opacity: searchBarHeight,
            overflow: 'hidden',
          },
        ]}
      >
        <View style={[styles.searchBar, { backgroundColor: colors.card }]}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search orders or customers..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      </Animated.View>

      {/* Date Range Chip */}
      {dateRange && (
        <View style={styles.dateChipContainer}>
          <View style={[styles.dateChip, { backgroundColor: colors.goldLight }]}>
            <Ionicons name="calendar" size={14} color={colors.gold} />
            <Text style={[styles.dateChipText, { color: colors.gold }]}>
              {typeof dateRange === 'string'
                ? dateRange
                : `${format(dateRange.start!, 'MMM d')} - ${format(dateRange.end!, 'MMM d')}`}
            </Text>
            <Pressable onPress={clearDateRange} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.gold} />
            </Pressable>
          </View>
        </View>
      )}

      {/* Insight Card */}
      {showInsight && pendingCount > 0 && (
        <View style={[styles.insightCard, { backgroundColor: colors.card }, shadows.sm]}>
          <View style={styles.insightHeader}>
            <BaciLogo size={32} borderRadius={RADIUS.sm} />
            <View style={styles.storeInfo}>
              <Text style={[styles.storeName, { color: colors.gold }]}>{storeUrl}</Text>
            </View>
            <Pressable
              onPress={() => setShowInsight(false)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <View style={[styles.dismissButton, { backgroundColor: colors.backgroundLight }]}>
                <Ionicons name="close" size={16} color={colors.textMuted} />
              </View>
            </Pressable>
          </View>
          <Text style={[styles.insightMessage, { color: colors.textSecondary }]}>
            You have {pendingCount} pending orders awaiting confirmation. Process them to keep customers happy!
          </Text>
          <Pressable
            style={styles.insightLink}
            onPress={() => {
              setStatusFilter('pending');
              setShowInsight(false);
            }}
          >
            <Text style={[styles.insightLinkText, { color: colors.gold }]}>View pending</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.gold} />
          </Pressable>
        </View>
      )}

      {/* Filter Tabs - aligned with web app shipping statuses */}
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
          style={styles.filterContainer}
        >
          <FilterTab status="all" label="All" />
          <FilterTab status="pending" label="Pending" />
          <FilterTab status="processing" label="Processing" />
          <FilterTab status="shipped" label="Shipped" />
          <FilterTab status="delivered" label="Delivered" />
          <FilterTab status="cancelled" label="Cancelled" />
          <FilterTab status="returned" label="Returned" />
        </ScrollView>
      </View>

      {/* Orders List */}
      <FlatList
        data={orders}
        renderItem={renderOrder}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
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
              <Ionicons name="receipt-outline" size={56} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No orders found</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Orders will appear here when customers place them</Text>
            </View>
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Floating Action Button */}
      <Pressable
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.gold },
          shadows.lg,
          pressed && { opacity: 0.9, transform: [{ scale: 0.95 }] },
        ]}
        onPress={() => router.push('/order/new')}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </Pressable>

      <DateRangePicker
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onSelect={(filter) => {
          // @ts-ignore - aligning types
          setDateRange(filter);
        }}
        currentFilter={dateRange}
      />

      <OrderReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        onExport={handleExport}
        orders={allOrders}
        dateRangeLabel={dateRangeLabel}
        businessName={merchant?.business_name || 'My Store'}
        logoUrl={merchant?.logo_url || undefined}
        onDateSelect={() => {
          setShowReportModal(false);
          setTimeout(() => setShowDatePicker(true), 300); // Small delay for smooth transition
        }}
        onPresetSelect={(preset) => {
          const now = new Date();
          let start = new Date();
          let end = new Date();

          switch (preset) {
            case 'Today':
              start = now;
              end = now;
              break;
            case 'Yesterday':
              const yester = new Date();
              yester.setDate(yester.getDate() - 1);
              start = yester;
              end = yester;
              break;
            case 'Last 7 Days':
              start = new Date();
              start.setDate(now.getDate() - 6);
              end = now;
              break;
            case 'Last 30 Days':
              start = new Date();
              start.setDate(now.getDate() - 29);
              end = now;
              break;
            case 'This Month':
              start = new Date(now.getFullYear(), now.getMonth(), 1);
              end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
              break;
          }
          setDateRange({ start, end });
        }}
      />

      {/* Status Dropdown */}
      {showStatusDropdown && selectedOrder && (
        <>
          {/* Backdrop to close dropdown */}
          <Pressable
            style={styles.dropdownBackdrop}
            onPress={closeStatusDropdown}
          />
          {/* Dropdown Menu */}
          <View
            style={[
              styles.statusDropdown,
              { backgroundColor: colors.card, top: dropdownPosition.y, left: dropdownPosition.x },
              shadows.lg,
            ]}
          >
            {getStatusActions(selectedOrder.shipping_status as ShippingStatus).length > 0 ? (
              getStatusActions(selectedOrder.shipping_status as ShippingStatus).map((action, index) => (
                <Pressable
                  key={action.status}
                  style={({ pressed }) => [
                    styles.dropdownItem,
                    index > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
                    pressed && { backgroundColor: colors.backgroundLight },
                  ]}
                  onPress={() => handleStatusUpdate(action.status)}
                  disabled={updateStatus.isPending}
                >
                  <Ionicons name={action.icon} size={18} color={action.color} />
                  <Text style={[styles.dropdownItemText, { color: action.color }]}>
                    {action.label}
                  </Text>
                  {updateStatus.isPending && (
                    <ActivityIndicator size="small" color={action.color} />
                  )}
                </Pressable>
              ))
            ) : (
              <View style={styles.dropdownItem}>
                <Text style={[styles.dropdownItemText, { color: colors.textMuted }]}>
                  No actions
                </Text>
              </View>
            )}
          </View>
        </>
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
  calendarButton: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
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
  dateChipContainer: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    gap: SPACING.xs,
  },
  dateChipText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  fab: {
    position: 'absolute',
    bottom: SPACING.xl,
    right: SPACING.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  datePickerModal: {
    width: '100%',
    maxWidth: 320,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
  },
  datePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  datePickerTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  presetContainer: {
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  presetButton: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  presetText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    textAlign: 'center',
  },
  clearButton: {
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
  },
  clearButtonText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    textAlign: 'center',
  },
  // Status Dropdown Styles
  dropdownBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99,
  },
  statusDropdown: {
    position: 'absolute',
    zIndex: 100,
    borderRadius: RADIUS.md,
    minWidth: 160,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  dropdownItemText: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  insightCard: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  storeInfo: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  storeName: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  dismissButton: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightMessage: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  insightLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  insightLinkText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  filterContainer: {
    marginBottom: SPACING.md,
    maxHeight: 50, // Constrain height to prevent layout shifts
  },
  filterContent: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    paddingRight: SPACING.xl, // Extra padding for last item
  },
  filterTab: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
  },
  filterText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  listContent: {
    padding: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: 80, // Extra space for FAB
    gap: SPACING.md,
  },
  orderCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  orderNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sourceIcon: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderNumber: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginBottom: SPACING.md,
  },
  statusBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  paymentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  paymentText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  customerName: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderTotal: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  orderMeta: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  orderMetaBold: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  orderMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderMetaDot: {
    marginHorizontal: 6,
    fontSize: TYPOGRAPHY.size.xs,
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
