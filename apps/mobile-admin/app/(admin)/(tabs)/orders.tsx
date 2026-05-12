/**
 * Orders Screen - Order Management Dashboard
 * Real-time order management with status updates
 */

// Shared types and constants from monorepo
import {
  BRAND_COLORS,
  PAYMENT_STATUS_CONFIG,
  type PaymentStatus,
  SHIPPING_STATUS_ACTIONS,
  SHIPPING_STATUS_CONFIG,
  type ShippingStatus,
} from '@baci/shared';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  type SectionListData,
  type SectionListRenderItemInfo,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateRangePicker from '@/components/ui/DateRangePicker';
import OrderReportModal from '@/components/ui/OrderReportModal';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useDebounce } from '@/hooks/useDebounce';
import { useMerchant } from '@/hooks/useMerchant';
import { useOrderCounts } from '@/hooks/useOrderCounts';
import { type Order, useOrders, useUpdateOrderStatus } from '@/hooks/useOrders';
import { useTheme } from '@/hooks/useTheme';
import { getOrdersViewState } from '@/lib/orders-view-state';
import {
  groupOrdersByRelativeDate,
  type OrderSection,
} from '@/utils/date-utils';
import { orderExportTools } from '@/utils/export-orders';

// Helper functions moved outside component
const formatPrice = (amount: number, currency: string = 'NGN') => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
};

const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-NG', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Order Item component — calls useTheme() internally per 2026 best practices
interface OrderItemProps {
  item: Order;
  currency: string;
  onPress: (id: string) => void;
  onStatusPress: (
    order: Order,
    event: {
      target: {
        measure: (
          callback: (
            x: number,
            y: number,
            width: number,
            height: number,
            pageX: number,
            pageY: number
          ) => void
        ) => void;
      };
    }
  ) => void;
  getShippingStatusConfig: (status: ShippingStatus) => {
    color: string;
    label: string;
  };
  getPaymentStatusConfig: (status: PaymentStatus) => {
    color: string;
    label: string;
  };
  getSourceConfig: (source: string | null) => {
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    label: string;
  };
}

function OrderItem({
  item,
  currency,
  onPress,
  onStatusPress,
  getShippingStatusConfig,
  getPaymentStatusConfig,
  getSourceConfig,
}: OrderItemProps) {
  const { colors, shadows } = useTheme();
  const shippingConfig = getShippingStatusConfig(
    item.shipping_status as ShippingStatus
  );
  const paymentConfig = getPaymentStatusConfig(
    item.payment_status as PaymentStatus
  );
  const sourceConfig = getSourceConfig(item.source);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.orderCard,
        { backgroundColor: colors.card, minHeight: 56 },
        shadows.sm,
        pressed && { backgroundColor: colors.cardHover },
      ]}
      onPress={() => onPress(item.id)}
      accessibilityLabel={`Order ${item.order_number} from ${item.customer_name}, ${formatPrice(item.total, currency)}, ${shippingConfig.label}, ${paymentConfig.label}`}
      accessibilityRole="button"
      accessibilityHint="View order details"
    >
      <View style={styles.orderHeader}>
        <View style={styles.orderNumberRow}>
          <View
            style={[
              styles.sourceIcon,
              { backgroundColor: `${sourceConfig.color}15` },
            ]}
          >
            <Ionicons
              name={sourceConfig.icon}
              size={16}
              color={sourceConfig.color}
            />
          </View>
          <Text style={[styles.customerName, { color: colors.text }]}>
            {item.customer_name}
          </Text>
        </View>
        <View style={styles.statusBadges}>
          <View
            style={[
              styles.paymentBadge,
              { backgroundColor: `${paymentConfig.color}20` },
            ]}
          >
            <Text style={[styles.paymentText, { color: paymentConfig.color }]}>
              {paymentConfig.label}
            </Text>
          </View>
          <Pressable
            style={[
              styles.statusBadge,
              { backgroundColor: `${shippingConfig.color}20`, minHeight: 32 },
            ]}
            onPress={(e) => {
              e.stopPropagation();
              onStatusPress(item, e);
            }}
            hitSlop={8}
            accessibilityLabel={`Shipping status: ${shippingConfig.label}. Tap to change status`}
            accessibilityRole="button"
            accessibilityHint="Opens status change menu"
          >
            <View
              style={[
                styles.statusDot,
                { backgroundColor: shippingConfig.color },
              ]}
            />
            <Text style={[styles.statusText, { color: shippingConfig.color }]}>
              {shippingConfig.label}
            </Text>
            <Ionicons
              name="chevron-down"
              size={12}
              color={shippingConfig.color}
            />
          </Pressable>
        </View>
      </View>

      <Text style={[styles.orderNumber, { color: colors.textSecondary }]}>
        {item.order_number}
      </Text>

      <View style={styles.orderFooter}>
        <Text style={[styles.orderTotal, { color: colors.text }]}>
          {formatPrice(item.total, currency)}
        </Text>
        <View style={styles.orderMetaRow}>
          <Text style={[styles.orderMetaBold, { color: colors.textSecondary }]}>
            {item.item_count ?? 0}{' '}
            {(item.item_count ?? 0) === 1 ? 'item' : 'items'}
          </Text>
          <Text style={[styles.orderMetaDot, { color: colors.textMuted }]}>
            •
          </Text>
          <Text style={[styles.orderMeta, { color: colors.textMuted }]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function OrdersScreen() {
  const { colors, shadows, isDark } = useTheme();
  const queryClient = useQueryClient();
  const {
    storeUrl,
    merchant,
    isLoading: isMerchantLoading,
    error: merchantError,
  } = useMerchant();
  const [statusFilter, setStatusFilter] = useState<ShippingStatus | undefined>(
    undefined
  );
  const [showInsight, setShowInsight] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [dateRange, setDateRange] = useState<
    string | { start: Date; end: Date } | null
  >(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });

  // Status update mutation
  const updateStatus = useUpdateOrderStatus();

  // Collapsible search bar animation
  const headerVisibilityAnim = useRef(new Animated.Value(1)).current;
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const lastScrollY = useRef(0);
  const isSearchVisible = useRef(true);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const diff = currentScrollY - lastScrollY.current;

    if (Math.abs(diff) > 10) {
      if (diff > 0 && isSearchVisible.current && currentScrollY > 50) {
        isSearchVisible.current = false;
        setIsHeaderCollapsed(true);
        Animated.timing(headerVisibilityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      } else if (diff < 0 && !isSearchVisible.current) {
        isSearchVisible.current = true;
        setIsHeaderCollapsed(false);
        Animated.timing(headerVisibilityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
    }

    lastScrollY.current = currentScrollY;
  };

  // Fetch orders with filter
  const {
    data,
    isLoading,
    isFetching: isOrdersFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error: ordersError,
  } = useOrders(statusFilter || 'all', debouncedSearch, dateRange);

  // Flatten pages into single array, deduplicating by ID
  const allOrdersRaw = data?.pages.flatMap((page) => page.orders) ?? [];
  const seenIds = new Set<string>();
  const allOrders = allOrdersRaw.filter((o) => {
    if (seenIds.has(o.id)) return false;
    seenIds.add(o.id);
    return true;
  });
  const hasMerchant = Boolean(merchant?.id);
  const listViewState = getOrdersViewState({
    hasMerchant,
    isMerchantLoading,
    merchantError,
    isOrdersLoading: isLoading,
    ordersError: ordersError instanceof Error ? ordersError : null,
    ordersLength: allOrders.length,
  });
  const isRefreshing = isMerchantLoading || isOrdersFetching;

  // Fetch order counts
  const { data: counts } = useOrderCounts();

  const pendingCount = counts?.pending ?? 0;

  // Format date range for display
  const clearDateRange = () => {
    setDateRange(null);
  };

  const dateRangeLabel = (() => {
    if (typeof dateRange === 'string') return dateRange;
    if (dateRange?.start && dateRange?.end) {
      return `${format(dateRange.start, 'MMM d, yyyy')} - ${format(dateRange.end, 'MMM d, yyyy')}`;
    }
    return 'All Time';
  })();
  const dateChipLabel =
    typeof dateRange === 'string'
      ? dateRange
      : dateRange
        ? `${format(dateRange.start, 'MMM d')} - ${format(dateRange.end, 'MMM d')}`
        : null;

  const handleExport = async () => {
    if (allOrders.length === 0) return;
    await orderExportTools.exportOrdersRPC(allOrders);
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
  const getStatusActions = (
    currentStatus: ShippingStatus
  ): {
    status: ShippingStatus;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
  }[] => {
    const targetStatus = (
      (currentStatus as string) === 'fulfilled' ? 'pending' : currentStatus
    ) as ShippingStatus;
    const actions = SHIPPING_STATUS_ACTIONS[targetStatus] ?? [];
    return actions.map((action) => ({
      status: action.nextStatus,
      label: action.label,
      icon: action.icon as keyof typeof Ionicons.glyphMap,
      color: getColorFromKey(
        SHIPPING_STATUS_CONFIG[action.nextStatus]?.colorKey ?? 'textMuted'
      ),
    }));
  };

  // Handle status update
  const handleStatusUpdate = async (newStatus: ShippingStatus) => {
    if (!selectedOrder) return;

    if (
      newStatus === 'processing' &&
      selectedOrder.payment_status !== 'paid' &&
      !selectedOrder.is_credit_order
    ) {
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
              router.push(`/order/${selectedOrder.id}?action=record-payment`);
            },
          },
          {
            text: 'Ship on Credit',
            style: 'destructive',
            onPress: () => {
              setSelectedOrder(null);
              router.push(`/order/${selectedOrder.id}?action=ship-on-credit`);
            },
          },
        ]
      );
      return;
    }

    try {
      await updateStatus.mutateAsync({
        orderId: selectedOrder.id,
        status: newStatus,
      });
      setShowStatusDropdown(false);
      setSelectedOrder(null);
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const openStatusDropdown = (
    order: Order,
    event: {
      target: {
        measure: (
          callback: (
            x: number,
            y: number,
            width: number,
            height: number,
            pageX: number,
            pageY: number
          ) => void
        ) => void;
      };
    }
  ) => {
    event.target.measure(
      (
        _x: number,
        _y: number,
        _width: number,
        height: number,
        pageX: number,
        pageY: number
      ) => {
        setDropdownPosition({ x: pageX - 100, y: pageY + height + 4 });
        setSelectedOrder(order);
        setShowStatusDropdown(true);
      }
    );
  };

  // Close dropdown
  const closeStatusDropdown = () => {
    setShowStatusDropdown(false);
    setSelectedOrder(null);
  };

  // Get shipping status display config (using shared config + theme colors)
  const getShippingStatusConfig = (status: ShippingStatus) => {
    const config =
      SHIPPING_STATUS_CONFIG[status] ?? SHIPPING_STATUS_CONFIG.pending;
    return {
      color: getColorFromKey(config.colorKey),
      label: config.label,
    };
  };

  // Get payment status display config (using shared config + theme colors)
  const getPaymentStatusConfig = (status: PaymentStatus) => {
    const config =
      PAYMENT_STATUS_CONFIG[status] ?? PAYMENT_STATUS_CONFIG.pending;
    return {
      color: getColorFromKey(config.colorKey),
      label: config.label,
    };
  };

  // Source icon config (using shared config + theme colors)
  const getSourceConfig = (source: string | null) => {
    if (!source)
      return {
        icon: 'globe-outline' as const,
        color: colors.textSecondary,
        label: 'Website',
      };

    const normalizedSource = source.toLowerCase().trim();

    switch (normalizedSource) {
      case 'instagram':
        return {
          icon: 'logo-instagram' as const,
          color: '#C13584',
          label: 'Instagram',
        };
      case 'whatsapp':
        return {
          icon: 'logo-whatsapp' as const,
          color: '#25D366',
          label: 'WhatsApp',
        };
      case 'facebook':
        return {
          icon: 'logo-facebook' as const,
          color: '#1877F2',
          label: 'Facebook',
        };
      case 'twitter':
      case 'x':
        return {
          icon: 'logo-twitter' as const,
          color: '#1DA1F2',
          label: 'Twitter',
        };
      case 'tiktok':
        return {
          icon: 'logo-tiktok' as const,
          color: '#000000',
          label: 'TikTok',
        };
      case 'snapchat':
        return {
          icon: 'logo-snapchat' as const,
          color: '#FFFC00',
          label: 'Snapchat',
        };
      case 'youtube':
        return {
          icon: 'logo-youtube' as const,
          color: '#FF0000',
          label: 'YouTube',
        };
      case 'pinterest':
        return {
          icon: 'logo-pinterest' as const,
          color: '#BD081C',
          label: 'Pinterest',
        };
      case 'linkedin':
        return {
          icon: 'logo-linkedin' as const,
          color: '#0A66C2',
          label: 'LinkedIn',
        };
      case 'telegram':
        return {
          icon: 'paper-plane' as const,
          color: '#0088CC',
          label: 'Telegram',
        };
      case 'amazon':
        return {
          icon: 'logo-amazon' as const,
          color: '#FF9900',
          label: 'Amazon',
        };
      case 'jumia':
        return { icon: 'cart' as const, color: '#FF9900', label: 'Jumia' };
      case 'konga':
        return { icon: 'cart' as const, color: '#ED017F', label: 'Konga' };
      case 'jiji':
        return { icon: 'cart' as const, color: '#3DBE29', label: 'Jiji' };
      case 'mobile_app':
        return {
          icon: 'phone-portrait-outline' as const,
          color: colors.primary,
          label: 'Mobile App',
        };
      case 'online_store':
      case 'website':
      case 'storefront':
        return {
          icon: 'globe-outline' as const,
          color: colors.info || colors.textSecondary,
          label: 'Website',
        };
      case 'pos':
        return {
          icon: 'calculator-outline' as const,
          color: colors.success,
          label: 'POS',
        };
      case 'physical':
        return {
          icon: 'storefront-outline' as const,
          color: colors.gold,
          label: 'Store',
        };
      case 'staff_entry':
        return {
          icon: 'person-outline' as const,
          color: colors.textSecondary,
          label: 'Staff',
        };
      default: {
        const label = source.charAt(0).toUpperCase() + source.slice(1);
        return {
          icon: 'pricetag-outline' as const,
          color: colors.textSecondary,
          label: label,
        };
      }
    }
  };

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const handleRetry = () => {
    void queryClient.invalidateQueries({ queryKey: ['merchant'] });

    if (!merchant?.id) {
      return;
    }

    void queryClient.invalidateQueries({ queryKey: ['orders', merchant.id] });
    void queryClient.invalidateQueries({
      queryKey: ['order-counts', merchant.id],
    });
  };
  const retryAccessibilityLabel = 'Retry';
  const retryAccessibilityHint = 'Retry the request';

  const handleDateFilterSelect = (
    filter: string | { start: Date | null; end: Date | null } | null
  ) => {
    if (filter === null || typeof filter === 'string') {
      setDateRange(filter);
      return;
    }

    if (filter.start && filter.end) {
      setDateRange({ start: filter.start, end: filter.end });
      return;
    }

    setDateRange(null);
  };

  // Navigation callback for orders
  const handleOrderPress = (id: string) => {
    router.push(`/order/${id}`);
  };

  const merchantCurrency = merchant?.payout_currency || 'NGN';

  const renderOrder = ({
    item,
  }: SectionListRenderItemInfo<Order, OrderSection>) => (
    <OrderItem
      item={item}
      currency={merchantCurrency}
      onPress={handleOrderPress}
      onStatusPress={openStatusDropdown}
      getShippingStatusConfig={getShippingStatusConfig}
      getPaymentStatusConfig={getPaymentStatusConfig}
      getSourceConfig={getSourceConfig}
    />
  );

  const orderKeyExtractor = (item: Order) => item.id;

  // Group orders by relative date for section list
  const sections = groupOrdersByRelativeDate(allOrders);

  // Section header renderer
  const renderSectionHeader = ({
    section,
  }: {
    section: SectionListData<Order, OrderSection>;
  }) => (
    <View
      style={[styles.sectionHeader, { backgroundColor: colors.background }]}
    >
      <Text style={[styles.sectionHeaderText, { color: colors.textSecondary }]}>
        {section.title}
      </Text>
    </View>
  );

  const FilterTab = ({
    status,
    label,
  }: {
    status: ShippingStatus | 'all';
    label: string;
  }) => {
    const isActive =
      (status === 'all' && !statusFilter) || statusFilter === status;
    const count = counts
      ? status === 'all'
        ? counts.all
        : (counts[status] ?? 0)
      : 0;

    return (
      <Pressable
        style={[
          styles.filterTab,
          {
            backgroundColor: isActive ? colors.gold : colors.card,
          },
        ]}
        onPress={() =>
          setStatusFilter(
            status === 'all' ? undefined : (status as ShippingStatus)
          )
        }
        accessibilityLabel={`${label} orders: ${count}${isActive ? ', currently selected' : ''}`}
        accessibilityRole="tab"
        accessibilityState={{ selected: isActive }}
        accessibilityHint={`Filter to show ${label.toLowerCase()} orders`}
      >
        <Text
          style={[
            styles.filterText,
            { color: isActive ? '#000000' : colors.textSecondary },
          ]}
        >
          {label} ({count})
        </Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <SystemBars style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Orders</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            style={[styles.calendarButton, { backgroundColor: colors.card }]}
            onPress={() => setShowReportModal(true)}
            accessibilityLabel="Generate order report"
            accessibilityRole="button"
            accessibilityHint="Opens report generation options"
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
            accessibilityLabel="Filter by date range"
            accessibilityRole="button"
            accessibilityHint="Opens date range picker"
          >
            <Ionicons
              name="calendar-outline"
              size={22}
              color={colors.primary}
            />
          </Pressable>
        </View>
      </View>

      {/* Insight Card */}
      {showInsight && pendingCount > 0 ? (
        <View
          style={[
            styles.insightCard,
            { backgroundColor: colors.card },
            shadows.sm,
          ]}
        >
          <View style={styles.insightHeader}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: RADIUS.sm,
                backgroundColor: colors.goldLight,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="sparkles" size={20} color={colors.gold} />
            </View>
            <View style={styles.storeInfo}>
              <Text style={[styles.storeName, { color: colors.gold }]}>
                {storeUrl}
              </Text>
            </View>
            <Pressable
              onPress={() => setShowInsight(false)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Dismiss insight notification"
              accessibilityRole="button"
              style={{
                minWidth: 44,
                minHeight: 44,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <View
                style={[
                  styles.dismissButton,
                  { backgroundColor: colors.backgroundLight },
                ]}
              >
                <Ionicons name="close" size={16} color={colors.textMuted} />
              </View>
            </Pressable>
          </View>
          <Text
            style={[styles.insightMessage, { color: colors.textSecondary }]}
          >
            You have {pendingCount} pending orders awaiting confirmation.
            Process them to keep customers happy!
          </Text>
          <Pressable
            style={[styles.insightLink, { minHeight: 44 }]}
            onPress={() => {
              setStatusFilter('pending');
              setShowInsight(false);
            }}
            accessibilityLabel={`View ${pendingCount} pending orders`}
            accessibilityRole="button"
            accessibilityHint="Filters orders to show only pending orders"
          >
            <Text style={[styles.insightLinkText, { color: colors.gold }]}>
              View pending
            </Text>
            <Ionicons name="arrow-forward" size={14} color={colors.gold} />
          </Pressable>
        </View>
      ) : null}

      {/* Collapsible Search + Filter Header */}
      <Animated.View
        style={[
          styles.searchContainer,
          isHeaderCollapsed && styles.searchContainerCollapsed,
          {
            opacity: headerVisibilityAnim,
            transform: [
              {
                translateY: headerVisibilityAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-24, 0],
                }),
              },
            ],
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
          {searchQuery.length > 0 ? (
            <Pressable
              onPress={() => setSearchQuery('')}
              accessibilityLabel="Clear search"
              accessibilityRole="button"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{
                minWidth: 44,
                minHeight: 44,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Ionicons
                name="close-circle"
                size={20}
                color={colors.textMuted}
              />
            </Pressable>
          ) : null}
        </View>

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
      </Animated.View>

      {/* Date Range Chip */}
      {dateRange ? (
        <View style={styles.dateChipContainer}>
          <View
            style={[styles.dateChip, { backgroundColor: colors.goldLight }]}
          >
            <Ionicons name="calendar" size={14} color={colors.gold} />
            <Text style={[styles.dateChipText, { color: colors.gold }]}>
              {dateChipLabel}
            </Text>
            <Pressable
              onPress={clearDateRange}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Clear date filter"
              accessibilityRole="button"
              style={{
                minWidth: 44,
                minHeight: 44,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Ionicons name="close-circle" size={16} color={colors.gold} />
            </Pressable>
          </View>
        </View>
      ) : null}

      <SectionList
        sections={sections}
        renderItem={renderOrder}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={orderKeyExtractor}
        stickySectionHeadersEnabled={true}
        contentContainerStyle={styles.listContent}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={5}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRetry}
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
          listViewState.status === 'error' ? (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="alert-circle-outline"
                size={56}
                color={colors.error}
              />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {listViewState.title}
              </Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {listViewState.message}
              </Text>
              <Pressable
                style={[
                  styles.emptyAction,
                  { backgroundColor: colors.primary },
                ]}
                onPress={handleRetry}
                accessibilityLabel={retryAccessibilityLabel}
                accessibilityRole="button"
                accessibilityHint={retryAccessibilityHint}
              >
                <Text
                  style={[
                    styles.emptyActionText,
                    { color: colors.textOnPrimary },
                  ]}
                >
                  Try Again
                </Text>
              </Pressable>
            </View>
          ) : listViewState.status === 'empty' ? (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="receipt-outline"
                size={56}
                color={colors.textMuted}
              />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                No orders found
              </Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Orders will appear here when customers place them
              </Text>
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
        accessibilityLabel="Create new order"
        accessibilityRole="button"
        accessibilityHint="Opens form to create a new order"
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </Pressable>

      <DateRangePicker
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onSelect={handleDateFilterSelect}
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
          setTimeout(() => setShowDatePicker(true), 300);
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
            case 'Yesterday': {
              const yester = new Date();
              yester.setDate(yester.getDate() - 1);
              start = yester;
              end = yester;
              break;
            }
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
      {showStatusDropdown && selectedOrder ? (
        <>
          <Pressable
            style={styles.dropdownBackdrop}
            onPress={closeStatusDropdown}
            accessibilityLabel="Close status menu"
            accessibilityRole="button"
          />
          <View
            style={[
              styles.statusDropdown,
              {
                backgroundColor: colors.card,
                top: dropdownPosition.y,
                left: dropdownPosition.x,
              },
              shadows.lg,
            ]}
          >
            {getStatusActions(selectedOrder.shipping_status as ShippingStatus)
              .length > 0 ? (
              getStatusActions(
                selectedOrder.shipping_status as ShippingStatus
              ).map((action, index) => (
                <Pressable
                  key={action.status}
                  style={({ pressed }) => [
                    styles.dropdownItem,
                    { minHeight: 44 },
                    index > 0 && {
                      borderTopWidth: 1,
                      borderTopColor: colors.border,
                    },
                    pressed && { backgroundColor: colors.backgroundLight },
                  ]}
                  onPress={() => handleStatusUpdate(action.status)}
                  disabled={updateStatus.isPending}
                  accessibilityLabel={
                    updateStatus.isPending
                      ? `Updating to ${action.label}`
                      : action.label
                  }
                  accessibilityRole="menuitem"
                  accessibilityState={{ disabled: updateStatus.isPending }}
                  accessibilityHint={`Change order status to ${action.label.toLowerCase()}`}
                >
                  <Ionicons name={action.icon} size={18} color={action.color} />
                  <Text
                    style={[styles.dropdownItemText, { color: action.color }]}
                  >
                    {action.label}
                  </Text>
                  {updateStatus.isPending ? (
                    <ActivityIndicator size="small" color={action.color} />
                  ) : null}
                </Pressable>
              ))
            ) : (
              <View style={styles.dropdownItem}>
                <Text
                  style={[styles.dropdownItemText, { color: colors.textMuted }]}
                >
                  No actions
                </Text>
              </View>
            )}
          </View>
        </>
      ) : null}
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
  searchContainerCollapsed: {
    height: 0,
    marginBottom: 0,
    overflow: 'hidden',
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
    marginTop: SPACING.sm,
  },
  filterContent: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    paddingRight: SPACING.xl,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  listContent: {
    padding: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: 80,
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
  emptyAction: {
    marginTop: SPACING.md,
    minWidth: 140,
    minHeight: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  emptyActionText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  footerLoader: {
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  sectionHeader: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: 2,
    paddingTop: SPACING.xs,
  },
  sectionHeaderText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});
