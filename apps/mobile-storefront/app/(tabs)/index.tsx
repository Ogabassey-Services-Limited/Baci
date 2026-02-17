import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, StatusBar, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
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
import { usePageConfig } from '@/hooks/use-products';
import { CONFIG } from '@/lib/config';
import { getTemplateConfig } from '@/lib/templates';

const PATTERN_URI =
  'https://www.transparenttextures.com/patterns/carbon-fibre.png';

// 2026 Best Practice: Use any type for AnimatedFlashList
// The type system can't properly infer animated component types with FlashList generics
/* eslint-disable @typescript-eslint/no-explicit-any */
const AnimatedFlashList: any = Animated.createAnimatedComponent(
  FlashList as any
);
/* eslint-enable @typescript-eslint/no-explicit-any */

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const template = useMemo(
    () => getTemplateConfig(CONFIG.BUSINESS_TYPE, CONFIG.TEMPLATE_ID),
    []
  );

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
    const checkPermissions = async () => {
      setTimeout(async () => {
        const result = await requestPermission('tracking');
        if (result === 'soft-ask-needed') {
          setShowPermissionModal(true);
        }
      }, 3000); // 3 seconds delay
    };

    checkPermissions();
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

  // 2026 Best Practice: Animated Smart Header
  const lastScrollY = useSharedValue(0);
  const headerTranslateY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const currentY = event.contentOffset.y;
      const diff = currentY - lastScrollY.value;

      // 2026 Best Practice: Avoid hiding on bounces and initial scroll
      if (currentY <= 0) {
        headerTranslateY.value = withTiming(0, { duration: 250 });
      } else if (diff > 10 && currentY > 100) {
        // Scrolling down: hide header
        headerTranslateY.value = withTiming(-headerHeight, {
          duration: 300,
          easing: Easing.out(Easing.quad),
        });
      } else if (diff < -15) {
        // Scrolling up: show header
        headerTranslateY.value = withTiming(0, {
          duration: 250,
          easing: Easing.out(Easing.quad),
        });
      }

      lastScrollY.value = currentY;
    },
  });

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: headerTranslateY.value }],
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  }));

  const backgroundAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: -lastScrollY.value,
      },
    ],
  }));

  // 2026 Best Practice: Network state monitoring for offline UX
  const { isOnline, onReconnect } = useNetworkState();

  const [searchVisible, setSearchVisible] = useState(false);

  const handleSearch = useCallback(() => {
    setSearchVisible(true);
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  useEffect(() => {
    return onReconnect(() => {
      refetch();
    });
  }, [onReconnect, refetch]);

  const handleCategorySelect = useCallback((id: string | null) => {
    if (id?.startsWith('u-')) {
      // 2026 Best Practice: Route to Guest Utility Flow
      const type = id.replace('u-', '');
      router.push(`/utilities/${type}` as never);
      return;
    }
    setSelectedCategoryId(id);
  }, []);

  const defaultBlocks = useMemo(
    () => [
      { type: 'HeroCarousel', props: { id: 'default-hero' } },
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
    ],
    []
  );

  const blocks = useMemo(() => {
    let content = pageConfig?.content || defaultBlocks;

    // Force CategoryRail if it's missing but it's an Elite design context
    if (
      template.headerStyle === 'elite' &&
      !content.some((b) => b.type === 'CategoryRail')
    ) {
      const heroIndex = content.findIndex((b) => b.type === 'HeroCarousel');
      const injected = {
        type: 'CategoryRail' as const,
        props: { id: 'forced-categories', slug: 'utility' },
      };

      const newContent = [...content];
      if (heroIndex !== -1) {
        newContent.splice(heroIndex + 1, 0, injected);
      } else {
        newContent.unshift(injected);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      content = newContent as any;
    }

    if (isConfigLoading && !pageConfig) return [];
    return content;
  }, [pageConfig, isConfigLoading, defaultBlocks, template]);

  const renderItem = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ item }: { item: any }) => (
      <BlockRenderer
        blocks={[item]}
        selectedCategoryId={selectedCategoryId}
        onCategorySelect={handleCategorySelect}
      />
    ),
    [selectedCategoryId, handleCategorySelect]
  );

  const renderListHeader = () => <View style={{ height: headerHeight }} />;

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
      <StatusBar barStyle="light-content" />

      {/* Background Layer for Hero Overlap (Layer 1) */}
      {isElite && (
        <Animated.View
          style={[styles.eliteBackground, backgroundAnimatedStyle]}
        >
          <Image
            source={{ uri: PATTERN_URI }}
            style={[StyleSheet.absoluteFillObject, { opacity: 0.05 }]}
            contentFit="cover"
          />
        </Animated.View>
      )}

      <Animated.View
        style={headerAnimatedStyle}
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
      >
        <Header showSearch={true} onSearchPress={handleSearch} />

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
      </Animated.View>

      <AnimatedFlashList
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data={blocks as any}
        renderItem={renderItem}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        keyExtractor={(item: any, index: number) =>
          item.props?.id || `block-${index}`
        }
        ListHeaderComponent={renderListHeader}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        estimatedItemSize={600}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={BRAND.primary}
            colors={[BRAND.primary]}
            progressViewOffset={headerHeight}
          />
        }
        showsVerticalScrollIndicator={false}
      />
      <PermissionModal
        visible={showPermissionModal}
        type="tracking"
        onGrant={handlePermissionGrant}
        onDeny={handlePermissionDeny}
      />
      <SearchDropdown
        isVisible={searchVisible}
        onClose={() => setSearchVisible(false)}
        topOffset={headerHeight}
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
