import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import {
  Animated,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { OfflineNotice } from '@/components/OfflineNotice';
import { BlockRenderer } from '@/components/storefront/BlockRenderer';
import { Header } from '@/components/storefront/Header';
import { HomeServiceCards } from '@/components/storefront/HomeServiceCards';
import { SearchDropdown } from '@/components/storefront/SearchDropdown';
import { PermissionModal } from '@/components/ui/PermissionModal';
import { HeroSkeleton, ProductGridSkeleton } from '@/components/ui/Skeleton';
import { SnowEffect } from '@/components/ui/SnowEffect';
import { BRAND } from '@/constants/Colors';
import { ELITE_BACKDROP_HEIGHT } from '@/constants/layout';
import type { Block } from '@/types/blocks';
import { homeScreenStyles as styles } from './home-screen.styles';

const PATTERN_URI =
  'https://www.transparenttextures.com/patterns/carbon-fibre.png';

interface HomeScreenViewProps {
  backgroundColor: string;
  blackColor: string;
  blocks: Block[];
  contentBottomPadding: number;
  hasPageConfig: boolean;
  headerVisibility: Animated.Value;
  isConfigLoading: boolean;
  isElite: boolean;
  isError: boolean;
  isOnline: boolean;
  isScrolled: boolean;
  onCategorySelect: (id: string | null) => void;
  onHeaderLayout: (event: LayoutChangeEvent) => void;
  onListScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onPermissionDeny: () => void;
  onPermissionGrant: () => void;
  onRefresh: () => void;
  onSearch: () => void;
  onSearchCancel: () => void;
  onSearchQueryChange: (query: string) => void;
  onSearchSubmit: () => void;
  primaryProductGridIndex: number;
  productGridLoadMoreSignal: number;
  refreshing: boolean;
  resolvedHeaderHeight: number;
  searchQuery: string;
  searchVisible: boolean;
  selectedCategoryId: string | null;
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
  primaryProductGridIndex,
  productGridLoadMoreSignal,
  refreshing,
  resolvedHeaderHeight,
  searchQuery,
  searchVisible,
  selectedCategoryId,
  showPermissionModal,
}: HomeScreenViewProps) {
  if (isConfigLoading) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <Header showSearch />
        <HeroSkeleton />
        <ProductGridSkeleton count={4} />
      </View>
    );
  }

  const headerOverlayAnimatedStyle = {
    opacity: headerVisibility.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    }),
    transform: [
      {
        translateY: headerVisibility.interpolate({
          inputRange: [0, 1],
          outputRange: [-resolvedHeaderHeight, 0],
        }),
      },
    ],
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Stack.Screen options={{ headerShown: false, title: '' }} />
      <SnowEffect />
      <SystemBars style="light" />

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
          <Image
            source={{ uri: PATTERN_URI }}
            style={[StyleSheet.absoluteFillObject, { opacity: 0.05 }]}
            contentFit="cover"
          />
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

      <Animated.ScrollView
        testID="home-scroll-view"
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: contentBottomPadding },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={BRAND.primary}
            colors={[BRAND.primary]}
            progressViewOffset={resolvedHeaderHeight}
          />
        }
        showsVerticalScrollIndicator={false}
        onScroll={onListScroll}
        scrollEventThrottle={16}
      >
        <Animated.View
          testID="home-header-spacer"
          style={{ height: resolvedHeaderHeight }}
        />
        <BlockRenderer
          blocks={blocks}
          blockWrapperStyle={styles.blockWrapper}
          getProductGridLoadMoreSignal={(block, index) =>
            block.type === 'ProductGrid' && index === primaryProductGridIndex
              ? productGridLoadMoreSignal
              : 0
          }
          selectedCategoryId={selectedCategoryId}
          onCategorySelect={onCategorySelect}
          renderAfterBlock={(block) =>
            block.type === 'CategoryRail' ? (
              <HomeServiceCards placement="belowUtility" />
            ) : null
          }
        />
      </Animated.ScrollView>
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
