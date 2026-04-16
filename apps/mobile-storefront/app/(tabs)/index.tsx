import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OfflineNotice } from '@/components/OfflineNotice';
import { BlockRenderer } from '@/components/storefront/BlockRenderer';
import { Header } from '@/components/storefront/Header';
import { SearchDropdown } from '@/components/storefront/SearchDropdown';
// Footer component available but not currently rendered
// import { Footer } from '@/components/storefront/Footer';
import { PermissionModal } from '@/components/ui/PermissionModal';
import { HeroSkeleton, ProductGridSkeleton } from '@/components/ui/Skeleton';
import { SnowEffect } from '@/components/ui/SnowEffect';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import { getHomeContentBottomPadding } from '@/constants/layout';
import { usePageConfig } from '@/hooks';
import { useNetworkState } from '@/hooks/use-network-state';
import { usePermissionBooster } from '@/hooks/use-permission-booster';
import { CONFIG } from '@/lib/config';
import { resolveScrollHeaderVisibility } from '@/lib/scroll-header-visibility';
import { getTemplateConfig } from '@/lib/templates';
import type { Block } from '@/types/blocks';

const PATTERN_URI =
  'https://www.transparenttextures.com/patterns/carbon-fibre.png';
const LOAD_MORE_THRESHOLD_PX = 240;

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  const template = getTemplateConfig(CONFIG.BUSINESS_TYPE, CONFIG.TEMPLATE_ID);
  const isChatWidgetEnabled = template.features?.chatWidget ?? true;

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    template.headerStyle === 'elite' ? 'u-airtime' : null
  );
  const [productGridLoadMoreSignal, setProductGridLoadMoreSignal] = useState(0);
  const lastLoadMoreContentHeightRef = useRef(0);

  const { requestPermission, triggerSystemPrompt, markDenied } =
    usePermissionBooster();
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  useEffect(() => {
    // Check for tracking permissions (Soft Ask) - ATT
    // 2026 Best Practice: Ask during "personalized deal discovery" (Home screen)
    // Wait for a moment so they see the "deals" (products) first
    const timerId = setTimeout(async () => {
      const result = await requestPermission('tracking');
      if (result === 'soft-ask-needed') {
        setShowPermissionModal(true);
      }
    }, 3000); // 3 seconds delay

    return () => {
      clearTimeout(timerId);
    };
  }, [requestPermission]);

  const handlePermissionGrant = async () => {
    setShowPermissionModal(false);
    await triggerSystemPrompt('tracking');
  };

  const handlePermissionDeny = () => {
    setShowPermissionModal(false);
    markDenied('tracking');
  };

  const {
    data: pageConfig,
    isLoading: isConfigLoading,
    refetch,
    isError,
  } = usePageConfig('home');

  const [refreshing, setRefreshing] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(150); // Initial estimate for spacer
  const headerVisibility = useRef(new Animated.Value(1)).current;
  const headerScrollState = useRef({
    isVisible: true,
    previousOffsetY: 0,
  });

  // 2026 Best Practice: Network state monitoring for offline UX
  // Note: Manual onReconnect refetch removed — onlineManager.setOnline(true)
  // combined with refetchOnReconnect: true handles automatic refetching.
  const { isOnline } = useNetworkState();

  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = () => {
    headerScrollState.current = {
      isVisible: true,
      previousOffsetY: 0,
    };
    animateHeaderVisibility(true);
    setSearchVisible(true);
  };

  const handleSearchCancel = () => {
    setSearchVisible(false);
    setSearchQuery('');
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      lastLoadMoreContentHeightRef.current = 0;
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const animateHeaderVisibility = (isVisible: boolean) => {
    Animated.timing(headerVisibility, {
      toValue: isVisible ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  };

  const handleHeaderLayout = ({
    nativeEvent,
  }: {
    nativeEvent: { layout: { height: number } };
  }) => {
    const nextHeight = nativeEvent.layout.height;
    if (nextHeight > 0 && Math.abs(nextHeight - headerHeight) > 1) {
      setHeaderHeight(nextHeight);
    }
  };

  const handleListScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (searchVisible) {
      return;
    }

    const currentState = headerScrollState.current;
    const currentOffsetY = event.nativeEvent.contentOffset.y;
    const isScrollingDown = currentOffsetY >= currentState.previousOffsetY;
    const nextState = resolveScrollHeaderVisibility({
      currentOffsetY,
      previousOffsetY: currentState.previousOffsetY,
      isVisible: currentState.isVisible,
    });

    headerScrollState.current.previousOffsetY = nextState.previousOffsetY;

    if (nextState.isVisible !== currentState.isVisible) {
      headerScrollState.current.isVisible = nextState.isVisible;
      animateHeaderVisibility(nextState.isVisible);
    }

    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom =
      contentSize.height - (contentOffset.y + layoutMeasurement.height);

    if (
      isScrollingDown &&
      distanceFromBottom <= LOAD_MORE_THRESHOLD_PX &&
      contentSize.height > lastLoadMoreContentHeightRef.current
    ) {
      lastLoadMoreContentHeightRef.current = contentSize.height;
      setProductGridLoadMoreSignal((current) => current + 1);
    }
  };

  const handleCategorySelect = (id: string | null) => {
    if (id?.startsWith('u-')) {
      // 2026 Best Practice: Route to Guest Utility Flow
      const type = id.replace('u-', '');
      router.push(`/utilities/${type}` as never);
      return;
    }
    setSelectedCategoryId(id);
  };

  const defaultBlocks: Block[] = [
    { type: 'HeroCarousel', props: { id: 'default-hero', slides: [] } },
    {
      type: 'CategoryRail',
      props: { id: 'default-categories', title: 'Shop by Category' },
    },
    {
      type: 'ProductGrid',
      props: {
        id: 'default-products',
        title: 'Featured Products',
        limit: 12,
      },
    },
  ];

  const blocks: Block[] = (() => {
    const isBlockArray = (arr: unknown[]): arr is Block[] =>
      arr.every(
        (item) =>
          typeof item === 'object' &&
          item !== null &&
          'type' in item &&
          'props' in item
      );
    let content: Block[] =
      pageConfig?.content && isBlockArray(pageConfig.content)
        ? pageConfig.content
        : defaultBlocks;

    // Force CategoryRail if it's missing but it's an Elite design context
    if (
      template.headerStyle === 'elite' &&
      !content.some((b) => b.type === 'CategoryRail')
    ) {
      const heroIndex = content.findIndex((b) => b.type === 'HeroCarousel');
      const injected: Block = {
        type: 'CategoryRail' as const,
        props: { id: 'forced-categories', slug: 'utility' },
      };

      const newContent = [...content];
      if (heroIndex !== -1) {
        newContent.splice(heroIndex + 1, 0, injected);
      } else {
        newContent.unshift(injected);
      }
      content = newContent;
    }

    if (isConfigLoading && !pageConfig) return [];
    return content;
  })();
  const productGridDatasetKey = JSON.stringify({
    selectedCategoryId,
    productGridBlockIds: blocks
      .filter((block) => block.type === 'ProductGrid')
      .map((block) => block.props.id ?? block.type),
  });
  const primaryProductGridId =
    blocks.find((block) => block.type === 'ProductGrid')?.props.id ?? null;

  useEffect(() => {
    void productGridDatasetKey;
    lastLoadMoreContentHeightRef.current = 0;
    headerScrollState.current.previousOffsetY = 0;
  }, [productGridDatasetKey]);

  const resolvedHeaderHeight = headerHeight > 0 ? headerHeight : 150;
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
  const headerSpacerAnimatedStyle = {
    height: headerVisibility.interpolate({
      inputRange: [0, 1],
      outputRange: [0, resolvedHeaderHeight],
    }),
  };

  const isElite = template.headerStyle === 'elite';
  const homeContentBottomPadding = getHomeContentBottomPadding(
    insets.bottom,
    isChatWidgetEnabled
  );

  if (isConfigLoading && !refreshing) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header showSearch={true} />
        <HeroSkeleton />
        <ProductGridSkeleton count={4} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false, title: '' }} />
      <SnowEffect />
      <SystemBars style="light" />

      {/* Background Layer for Hero Overlap (Layer 1) */}
      {isElite && (
        <View style={styles.eliteBackground}>
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
        <View onLayout={handleHeaderLayout}>
          <Header
            showSearch={true}
            onSearchPress={handleSearch}
            isSearchActive={searchVisible}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            onSearchCancel={handleSearchCancel}
          />

          {!isOnline && pageConfig && (
            <OfflineNotice
              variant="banner"
              showCachedDataNotice
              showRetry
              onRetry={handleRefresh}
              isRetrying={refreshing}
            />
          )}

          {isError && isOnline && (
            <OfflineNotice
              variant="inline"
              message="Failed to load content"
              showRetry
              onRetry={handleRefresh}
              isRetrying={refreshing}
            />
          )}
        </View>
      </Animated.View>

      <Animated.ScrollView
        testID="home-scroll-view"
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: homeContentBottomPadding },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={BRAND.primary}
            colors={[BRAND.primary]}
            progressViewOffset={resolvedHeaderHeight}
          />
        }
        showsVerticalScrollIndicator={false}
        onScroll={handleListScroll}
        scrollEventThrottle={16}
      >
        <Animated.View style={headerSpacerAnimatedStyle} />
        {blocks.map((block: Block, index: number) => (
          <View key={block.props?.id || `block-${index}`}>
            <BlockRenderer
              blocks={[block]}
              productGridLoadMoreSignal={
                block.type === 'ProductGrid' &&
                block.props?.id === primaryProductGridId
                  ? productGridLoadMoreSignal
                  : 0
              }
              selectedCategoryId={selectedCategoryId}
              onCategorySelect={handleCategorySelect}
            />
          </View>
        ))}
      </Animated.ScrollView>
      <PermissionModal
        visible={showPermissionModal}
        type="tracking"
        onGrant={handlePermissionGrant}
        onDeny={handlePermissionDeny}
      />
      <SearchDropdown
        isVisible={searchVisible}
        onClose={handleSearchCancel}
        topOffset={resolvedHeaderHeight}
        query={searchQuery}
        onQueryChange={setSearchQuery}
        hideInput={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  eliteBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 260, // Refined for horizontal rectangle hero
    backgroundColor: '#000',
    zIndex: 0,
  },
  contentContainer: {
    flexGrow: 1,
  },
});
