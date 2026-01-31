import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, StatusBar, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { BlockRenderer } from '@/components/storefront/BlockRenderer';
import { OfflineNotice } from '@/components/OfflineNotice';
import { Header } from '@/components/storefront/Header';
import { HeroSkeleton, ProductGridSkeleton } from '@/components/ui/Skeleton';
import { SnowEffect } from '@/components/ui/SnowEffect';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import { useNetworkState } from '@/hooks/use-network-state';
import { usePageConfig } from '@/hooks/use-products';
import { CONFIG } from '@/lib/config';
import { getTemplateConfig } from '@/lib/templates';
import { Footer } from '@/components/storefront/Footer';

const PATTERN_URI =
  'https://www.transparenttextures.com/patterns/carbon-fibre.png';

const AnimatedFlashList = Animated.createAnimatedComponent(FlashList) as any;

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

  const handleSearch = useCallback(() => {
    router.push('/search');
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

  const handleCategorySelect = (id: string | null) => {
    if (id && id.startsWith('u-')) {
      // 2026 Best Practice: Utility items bridge to Fintech services (Kuda API)
      router.push('/wallet');
      return;
    }
    setSelectedCategoryId(id);
  };

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
    if (template.headerStyle === 'elite' && !content.some(b => b.type === 'CategoryRail')) {
      const heroIndex = content.findIndex(b => b.type === 'HeroCarousel');
      const injected = {
        type: 'CategoryRail' as const,
        props: { id: 'forced-categories', slug: 'utility' }
      };

      const newContent = [...content];
      if (heroIndex !== -1) {
        newContent.splice(heroIndex + 1, 0, injected);
      } else {
        newContent.unshift(injected);
      }
      content = newContent as any;
    }

    if (isConfigLoading && !pageConfig) return [];
    return content;
  }, [pageConfig, isConfigLoading, defaultBlocks, template]);

  if (isConfigLoading && !refreshing) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header showSearch={true} />
        <HeroSkeleton />
        <ProductGridSkeleton count={4} />
      </View>
    );
  }

  const renderItem = useCallback(
    ({ item }: { item: any }) => (
      <BlockRenderer
        blocks={[item]}
        selectedCategoryId={selectedCategoryId}
        onCategorySelect={handleCategorySelect}
      />
    ),
    [selectedCategoryId, handleCategorySelect]
  );

  const renderListHeader = () => (
    <View style={{ height: headerHeight }} />
  );

  const isElite = template.headerStyle === 'elite';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SnowEffect />
      <StatusBar barStyle="light-content" />

      {/* Background Layer for Hero Overlap (Layer 1) */}
      {isElite && (
        <Animated.View style={[styles.eliteBackground, backgroundAnimatedStyle]}>
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
        data={blocks as any}
        renderItem={renderItem}
        keyExtractor={(item: any, index: number) => item.props?.id || `block - ${index} `}
        ListHeaderComponent={renderListHeader}
        extraData={selectedCategoryId}
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
