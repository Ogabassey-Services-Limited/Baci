import { Stack } from 'expo-router';
import {
  type LayoutChangeEvent,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  type ScrollHandlerProcessed,
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { OfflineNotice } from '@/components/OfflineNotice';
import { GadgetPattern } from '@/components/storefront/GadgetPattern';
import { Header } from '@/components/storefront/Header';
import { SearchDropdown } from '@/components/storefront/SearchDropdown';
import { PermissionModal } from '@/components/ui/PermissionModal';
import { HeroSkeleton, ProductGridSkeleton } from '@/components/ui/Skeleton';
import { SnowEffect } from '@/components/ui/SnowEffect';
import { useColorScheme } from '@/components/useColorScheme';
import { ELITE_BACKDROP_HEIGHT } from '@/constants/layout';
import type { Block } from '@/types/blocks';
import { HomeFeedList } from './HomeFeedList';
import { homeScreenStyles as styles } from './home-screen.styles';
import { useHomeNavigationBarStyle } from './useHomeNavigationBarStyle';

interface HomeScreenViewProps {
  backgroundColor: string;
  blackColor: string;
  blocks: Block[];
  contentBottomPadding: number;
  hasPageConfig: boolean;
  headerVisibility: SharedValue<number>;
  isConfigLoading: boolean;
  isElite: boolean;
  isError: boolean;
  isOnline: boolean;
  isScrolled: boolean;
  onCategorySelect: (id: string | null) => void;
  onHeaderLayout: (event: LayoutChangeEvent) => void;
  onListScroll: ScrollHandlerProcessed<Record<string, unknown>>;
  onPermissionDeny: () => void;
  onPermissionGrant: () => void;
  onRefresh: () => void;
  onSearch: () => void;
  onSearchCancel: () => void;
  onSearchQueryChange: (query: string) => void;
  onSearchSubmit: () => void;
  primaryColor: string;
  primaryProductGridIndex: number;
  refreshing: boolean;
  resolvedHeaderHeight: number;
  searchQuery: string;
  searchVisible: boolean;
  selectedCategoryId: string | null;
  shouldRenderDecorations: boolean;
  showPermissionModal: boolean;
}

export function HomeScreenView({
  backgroundColor,
  blackColor,
  blocks,
  contentBottomPadding,
  hasPageConfig,
  headerVisibility,
  isConfigLoading,
  isElite,
  isError,
  isOnline,
  isScrolled,
  onCategorySelect,
  onHeaderLayout,
  onListScroll,
  onPermissionDeny,
  onPermissionGrant,
  onRefresh,
  onSearch,
  onSearchCancel,
  onSearchQueryChange,
  onSearchSubmit,
  primaryColor,
  primaryProductGridIndex,
  refreshing,
  resolvedHeaderHeight,
  searchQuery,
  searchVisible,
  selectedCategoryId,
  shouldRenderDecorations,
  showPermissionModal,
}: HomeScreenViewProps) {
  const colorScheme = useColorScheme();
  useHomeNavigationBarStyle(colorScheme, !isConfigLoading);

  const headerOverlayAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: headerVisibility.value,
      transform: [
        {
          translateY: interpolate(
            headerVisibility.value,
            [0, 1],
            [-resolvedHeaderHeight, 0],
            Extrapolation.CLAMP
          ),
        },
      ],
    };
  });

  if (isConfigLoading) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <Header showSearch />
        <HeroSkeleton />
        <ProductGridSkeleton count={4} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false, title: '' }} />
      {shouldRenderDecorations && <SnowEffect />}
      <StatusBar barStyle="light-content" />

      {/* Base background color layer to ensure reliable absolute rendering */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor }]} />

      {shouldRenderDecorations && (
        <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
          <GadgetPattern
            opacity={colorScheme === 'dark' ? 0.04 : 0.07}
            height={1500}
            color={colorScheme === 'dark' ? '#ffffff' : primaryColor}
          />
        </View>
      )}

      {isElite && (
        <View
          style={[
            styles.eliteBackground,
            {
              backgroundColor: blackColor,
              height: ELITE_BACKDROP_HEIGHT,
            },
          ]}
        >
          <GadgetPattern opacity={0.25} height={ELITE_BACKDROP_HEIGHT} />
        </View>
      )}

      <Animated.View
        style={[
          styles.headerOverlay,
          { zIndex: searchVisible ? 10000 : 100 },
          headerOverlayAnimatedStyle,
        ]}
      >
        <View onLayout={onHeaderLayout}>
          <Header
            showSearch
            onSearchPress={onSearch}
            isSearchActive={searchVisible}
            searchQuery={searchQuery}
            onSearchQueryChange={onSearchQueryChange}
            onSearchSubmit={onSearchSubmit}
            onSearchCancel={onSearchCancel}
            isScrolled={isScrolled}
          />

          {!isOnline && hasPageConfig && (
            <OfflineNotice
              variant="banner"
              showCachedDataNotice
              showRetry
              onRetry={onRefresh}
              isRetrying={refreshing}
            />
          )}

          {isError && isOnline && (
            <OfflineNotice
              variant="inline"
              message="Failed to load content"
              showRetry
              onRetry={onRefresh}
              isRetrying={refreshing}
            />
          )}
        </View>
      </Animated.View>

      <HomeFeedList
        blocks={blocks}
        primaryProductGridIndex={primaryProductGridIndex}
        selectedCategoryId={selectedCategoryId}
        onCategorySelect={onCategorySelect}
        onScroll={onListScroll}
        isSearchOpen={searchVisible}
        refreshing={refreshing}
        onRefresh={onRefresh}
        primaryColor={primaryColor}
        resolvedHeaderHeight={resolvedHeaderHeight}
        contentBottomPadding={contentBottomPadding}
        blockWrapperStyle={styles.blockWrapper}
      />
      <PermissionModal
        visible={showPermissionModal}
        type="tracking"
        onGrant={onPermissionGrant}
        onDeny={onPermissionDeny}
      />
      <SearchDropdown
        isVisible={searchVisible}
        onClose={onSearchCancel}
        topOffset={resolvedHeaderHeight}
        query={searchQuery}
        onQueryChange={onSearchQueryChange}
        hideInput={true}
      />
    </View>
  );
}
