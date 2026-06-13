import type { ShippingStatus } from '@baci/shared';
import {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SPACING } from '@/constants/theme';
import type { OrdersViewState } from '@/lib/orders-view-state';
import { OrdersDateChip } from './OrdersDateChip';
import { OrdersList } from './OrdersList';
import { OrdersSearchHeader } from './OrdersSearchHeader';
import type {
  OrdersCountSnapshot,
  OrdersListRenderItem,
  OrdersListRow,
  ThemeColors,
} from './types';

interface OrdersScrollSurfaceProps {
  colors: ThemeColors;
  searchQuery: string;
  statusFilter: ShippingStatus | undefined;
  counts: OrdersCountSnapshot | null | undefined;
  dateChipLabel: string | null;
  data: OrdersListRow[];
  stickyHeaderIndices: number[];
  isRefreshing: boolean;
  isFetchingNextPage: boolean;
  listViewState: OrdersViewState;
  renderItem: OrdersListRenderItem;
  onSearchChange: (value: string) => void;
  onStatusSelect: (status: ShippingStatus | undefined) => void;
  onClearDate: () => void;
  onRefresh: () => void;
  onEndReached: () => void;
}

export function OrdersScrollSurface({
  colors,
  searchQuery,
  statusFilter,
  counts,
  dateChipLabel,
  data,
  stickyHeaderIndices,
  isRefreshing,
  isFetchingNextPage,
  listViewState,
  renderItem,
  onSearchChange,
  onStatusSelect,
  onClearDate,
  onRefresh,
  onEndReached,
}: OrdersScrollSurfaceProps) {
  const headerVisibility = useSharedValue(1);
  const isSearchVisible = useSharedValue(true);
  const lastScrollY = useSharedValue(0);

  const handleScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet';
      const currentScrollY = event.contentOffset.y;
      const diff = currentScrollY - lastScrollY.get();

      if (Math.abs(diff) > 10) {
        if (diff > 0 && isSearchVisible.get() && currentScrollY > 50) {
          isSearchVisible.set(false);
          headerVisibility.set(withTiming(0, { duration: 200 }));
        } else if (diff < 0 && !isSearchVisible.get()) {
          isSearchVisible.set(true);
          headerVisibility.set(withTiming(1, { duration: 200 }));
        }
      }

      lastScrollY.set(currentScrollY);
    },
  });

  const searchHeaderStyle = useAnimatedStyle(() => {
    const collapsed = !isSearchVisible.get();

    return {
      height: collapsed ? 0 : undefined,
      marginBottom: collapsed ? 0 : SPACING.md,
      opacity: headerVisibility.get(),
      overflow: collapsed ? 'hidden' : 'visible',
      transform: [
        { translateY: interpolate(headerVisibility.get(), [0, 1], [-24, 0]) },
      ],
    };
  });

  return (
    <>
      <OrdersSearchHeader
        colors={colors}
        searchQuery={searchQuery}
        searchHeaderStyle={searchHeaderStyle}
        statusFilter={statusFilter}
        counts={counts}
        onSearchChange={onSearchChange}
        onStatusSelect={onStatusSelect}
      />
      <OrdersDateChip
        label={dateChipLabel}
        colors={colors}
        onClear={onClearDate}
      />
      <OrdersList
        colors={colors}
        data={data}
        stickyHeaderIndices={stickyHeaderIndices}
        isRefreshing={isRefreshing}
        isFetchingNextPage={isFetchingNextPage}
        listViewState={listViewState}
        renderItem={renderItem}
        onScroll={handleScroll}
        onRefresh={onRefresh}
        onEndReached={onEndReached}
      />
    </>
  );
}
