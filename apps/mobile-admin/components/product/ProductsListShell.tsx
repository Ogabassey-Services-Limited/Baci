import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list';
import type { ReactElement } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SPACING } from '@/constants/theme';

interface ProductsListShellProps<T> {
  colors: { gold: string };
  data?: T[] | null;
  emptyComponent: ReactElement | null;
  footerComponent?: ReactElement | null;
  keyExtractor: (item: T) => string;
  onEndReached?: () => void;
  onRefresh: () => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  renderItem: (info: ListRenderItemInfo<T>) => ReactElement | null;
  refreshing: boolean;
}

export function ProductsListShell<T>({
  colors,
  data,
  emptyComponent,
  footerComponent = null,
  keyExtractor,
  onEndReached,
  onRefresh,
  onScroll,
  renderItem,
  refreshing,
}: ProductsListShellProps<T>) {
  return (
    <FlashList
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[colors.gold]}
          tintColor={colors.gold}
        />
      }
      ListEmptyComponent={emptyComponent}
      ListFooterComponent={footerComponent}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      onScroll={onScroll}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    gap: SPACING.md,
    padding: SPACING.lg,
    paddingTop: 0,
  },
});
