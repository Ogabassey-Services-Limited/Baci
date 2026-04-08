import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list';
import type { Block } from '@/types/blocks';
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
import { useNetworkState } from '@/hooks/use-network-state';
import { usePermissionBooster } from '@/hooks/use-permission-booster';
import { usePageConfig } from '@/hooks';
import { CONFIG } from '@/lib/config';
import { resolveScrollHeaderVisibility } from '@/lib/scroll-header-visibility';
import { getTemplateConfig } from '@/lib/templates';

const PATTERN_URI =
  'https://www.transparenttextures.com/patterns/carbon-fibre.png';

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const template = getTemplateConfig(CONFIG.BUSINESS_TYPE, CONFIG.TEMPLATE_ID);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    template.headerStyle === 'elite' ? 'u-airtime' : null
  );

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

  const handleListScroll = (
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    if (searchVisible) {
      return;
    }

    const currentState = headerScrollState.current;
    const nextState = resolveScrollHeaderVisibility({
      currentOffsetY: event.nativeEvent.contentOffset.y,
      previousOffsetY: currentState.previousOffsetY,
      isVisible: currentState.isVisible,
    });

    headerScrollState.current.previousOffsetY = nextState.previousOffsetY;

    if (nextState.isVisible !== currentState.isVisible) {
      headerScrollState.current.isVisible = nextState.isVisible;
      animateHeaderVisibility(nextState.isVisible);
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
    const isBlockArray = (arr: unknown[]): arr is Block[] => arr.every(item => typeof item === 'object' && item !== null && 'type' in item && 'props' in item);
    let content: Block[] = pageConfig?.content && isBlockArray(pageConfig.content) ? pageConfig.content : defaultBlocks;

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

  const renderItem = ({ item }: ListRenderItemInfo<Block>) => (
    <BlockRenderer
      blocks={[item]}
      selectedCategoryId={selectedCategoryId}
      onCategorySelect={handleCategorySelect}
    />
  );

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

  const renderListHeader = () => (
    <Animated.View style={headerSpacerAnimatedStyle} />
  );

  const isElite = template.headerStyle === 'elite';

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

      <FlashList
        data={blocks}
        renderItem={renderItem}
        keyExtractor={(item: Block, index: number) =>
          item.props?.id || `block-${index}`
        }
        ListHeaderComponent={renderListHeader}
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
      />
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
  headerContainer: {
    marginBottom: 0,
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
});
