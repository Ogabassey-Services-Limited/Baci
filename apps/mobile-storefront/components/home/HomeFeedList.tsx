import {
  FlashList,
  type FlashListProps,
  type FlashListRef,
} from '@shopify/flash-list';
import {
  type ComponentProps,
  type ComponentType,
  useEffect,
  useRef,
} from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  type StyleProp,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, { type ScrollHandlerProcessed } from 'react-native-reanimated';
import { BlockRenderer } from '@/components/storefront/BlockRenderer';
import { FilterBar } from '@/components/storefront/FilterBar';
import { HomeServiceCards } from '@/components/storefront/HomeServiceCards';
import { ProductCard } from '@/components/storefront/ProductCard';
import { styles as gridStyles } from '@/components/storefront/ProductGrid.styles';
import { ProductGridSkeleton } from '@/components/ui/Skeleton';
import { palette } from '@/constants/Colors';
import { PRODUCT_GRID_LOADING_MORE_LABEL } from '@/constants/product-grid';
import { useTheme } from '@/hooks/useTheme';
import { CONFIG } from '@/lib/config';
import { getTemplateConfig } from '@/lib/templates';
import type { Block, ProductGridBlock } from '@/types/blocks';
import type { Product } from '@/types/product';
import { HomeFeedEmptyState } from './HomeFeedEmptyState';
import { homeFeedStyles } from './home-feed.styles';
import { useHomeProductFeed } from './use-home-product-feed';

const AnimatedFlashList = Animated.createAnimatedComponent(
  FlashList as ComponentType<FlashListProps<Product>>
);

interface HomeFeedListProps {
  blocks: Block[];
  primaryProductGridIndex: number;
  selectedCategoryId: string | null;
  onCategorySelect: (id: string | null) => void;
  onScroll: ScrollHandlerProcessed<Record<string, unknown>>;
  isSearchOpen: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  primaryColor: string;
  resolvedHeaderHeight: number;
  contentBottomPadding: number;
  blockWrapperStyle?: StyleProp<ViewStyle>;
}

/**
 * The single virtualized scroll container for the home feed. The primary
 * product grid's products are the FlashList `data` (recycled); every non-grid
 * block becomes header/footer. The Reanimated header-fold handler is passed in
 * from `HomeScreen` and bound via `Animated.createAnimatedComponent(FlashList)`.
 */
export function HomeFeedList({
  blocks,
  primaryProductGridIndex,
  selectedCategoryId,
  onCategorySelect,
  onScroll,
  isSearchOpen,
  refreshing,
  onRefresh,
  primaryColor,
  resolvedHeaderHeight,
  contentBottomPadding,
  blockWrapperStyle,
}: HomeFeedListProps) {
  const { colors } = useTheme();
  const hasPrimaryGrid = primaryProductGridIndex >= 0;
  const template = getTemplateConfig(CONFIG.BUSINESS_TYPE, CONFIG.TEMPLATE_ID);
  const primaryBlock = hasPrimaryGrid
    ? (blocks[primaryProductGridIndex] as ProductGridBlock)
    : undefined;
  const limit = primaryBlock?.props.limit ?? 12;
  const blockTitle = primaryBlock?.props.title;

  const {
    feedProducts,
    isLoading,
    isFetching,
    isLoadingMore,
    isRetrying,
    currentVariant,
    filterBarProps,
    handleRetry,
    loadMore,
    shouldShowFatalError,
    shouldShowInitialLoading,
    feedResetKey,
  } = useHomeProductFeed({
    enabled: hasPrimaryGrid,
    selectedCategoryId,
    variant: template.cardVariant,
    limit,
  });

  const listRef = useRef<FlashListRef<Product>>(null);

  // Scroll to top when the active filter/category set changes — a same-variant
  // data swap doesn't remount, and mVCP could otherwise pin to a removed item.
  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [feedResetKey]);

  const numColumns = currentVariant === 'grid' ? 2 : 1;
  const headerBlocks = hasPrimaryGrid
    ? blocks.slice(0, primaryProductGridIndex)
    : blocks;
  const footerBlocks = hasPrimaryGrid
    ? blocks.slice(primaryProductGridIndex + 1)
    : [];

  const renderItem = ({ item, index }: { item: Product; index: number }) => {
    if (currentVariant === 'grid') {
      return (
        <View
          style={[
            homeFeedStyles.productWrapper,
            index % 2 === 0
              ? homeFeedStyles.productLeft
              : homeFeedStyles.productRight,
          ]}
        >
          <ProductCard product={item} variant="grid" />
        </View>
      );
    }

    return (
      <View style={homeFeedStyles.fullWidthCell}>
        <ProductCard product={item} variant={currentVariant} />
      </View>
    );
  };

  const handleEndReached = () => {
    // No-op while the search overlay is open or the home has no product grid.
    if (!hasPrimaryGrid || isSearchOpen) return;
    loadMore();
  };

  const listHeader = (
    <View>
      <View
        testID="home-feed-header-spacer"
        style={{ height: resolvedHeaderHeight }}
      />
      <BlockRenderer
        blocks={headerBlocks}
        selectedCategoryId={selectedCategoryId}
        onCategorySelect={onCategorySelect}
        blockWrapperStyle={blockWrapperStyle}
        renderAfterBlock={(block) =>
          block.type === 'CategoryRail' ? (
            <HomeServiceCards placement="belowUtility" />
          ) : null
        }
      />
      {hasPrimaryGrid ? (
        <>
          {blockTitle ? (
            <Text style={[gridStyles.sectionTitle, { color: colors.text }]}>
              {blockTitle}
            </Text>
          ) : null}
          <FilterBar {...filterBarProps} />
        </>
      ) : null}
    </View>
  );

  const listFooter = (
    <View>
      {isLoadingMore ? (
        <View
          style={gridStyles.loadingMore}
          accessible
          accessibilityLabel={PRODUCT_GRID_LOADING_MORE_LABEL}
          accessibilityRole="progressbar"
          testID="home-feed-loading-more"
        >
          <ActivityIndicator
            size="small"
            color={palette.gray[400]}
            accessibilityElementsHidden
          />
        </View>
      ) : null}
      <BlockRenderer
        blocks={footerBlocks}
        selectedCategoryId={selectedCategoryId}
        onCategorySelect={onCategorySelect}
        blockWrapperStyle={blockWrapperStyle}
      />
    </View>
  );

  const listEmpty = hasPrimaryGrid ? (
    <HomeFeedEmptyState
      shouldShowFatalError={shouldShowFatalError}
      shouldShowInitialLoading={shouldShowInitialLoading}
      isLoading={isLoading}
      isFetching={isFetching}
      isRetrying={isRetrying}
      onRetry={handleRetry}
      skeleton={<ProductGridSkeleton count={4} />}
    />
  ) : null;

  return (
    <AnimatedFlashList
      // Reanimated rewrites the animated component's ref type, but the instance
      // is a FlashListRef at runtime (used for scrollToOffset above).
      ref={
        listRef as unknown as ComponentProps<typeof AnimatedFlashList>['ref']
      }
      key={`home-feed-${currentVariant}-${numColumns}`}
      testID="home-feed-list"
      data={feedProducts}
      numColumns={numColumns}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      onScroll={onScroll}
      scrollEventThrottle={16}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={primaryColor}
          colors={[primaryColor]}
          progressViewOffset={resolvedHeaderHeight}
        />
      }
      ListHeaderComponent={listHeader}
      ListFooterComponent={listFooter}
      ListEmptyComponent={listEmpty}
      contentContainerStyle={{
        paddingBottom: contentBottomPadding,
        paddingHorizontal: currentVariant === 'grid' ? 16 : 0,
      }}
      showsVerticalScrollIndicator={false}
    />
  );
}
