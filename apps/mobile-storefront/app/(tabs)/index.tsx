import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { RefreshControl, StatusBar, StyleSheet, View } from 'react-native';
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
import type { Block } from '@/types/blocks';

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
    data: pageConfigResult,
    isLoading: isConfigLoading,
    refetch,
    isError,
  } = usePageConfig('home');
  const pageConfig = pageConfigResult?.config ?? null;

  const [refreshing, setRefreshing] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(150); // Initial estimate for spacer

  // 2026 Best Practice: Network state monitoring for offline UX
  const { isOnline, onReconnect } = useNetworkState();

  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = () => {
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

  useEffect(() => {
    return onReconnect(() => {
      refetch();
    });
  }, [onReconnect, refetch]);

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

  const blocks = (() => {
    let content = pageConfig?.content || defaultBlocks;

    // Ensure home always has a hero slot; some templates use custom hero block names
    // and some published configs may omit hero entirely.
    const hasHeroBlock = content.some((b: Block) =>
      /hero/i.test(String(b.type))
    );
    if (!hasHeroBlock) {
      const injectedHero: Block = {
        type: 'HeroCarousel',
        props: { id: 'forced-hero', slides: [] },
      };
      content = [injectedHero, ...content];
    }

    // Force CategoryRail if it's missing but it's an Elite design context
    if (
      template.headerStyle === 'elite' &&
      !content.some((b: Block) => b.type === 'CategoryRail')
    ) {
      const heroIndex = content.findIndex(
        (b: Block) => b.type === 'HeroCarousel'
      );
      const injected = {
        type: 'CategoryRail' as const,
        props: { id: 'forced-categories', title: '', slug: 'utility' },
      } as Block;

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderItem = ({ item }: { item: any }) => (
    <BlockRenderer
      blocks={[item]}
      selectedCategoryId={selectedCategoryId}
      onCategorySelect={handleCategorySelect}
    />
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
        <View style={styles.eliteBackground}>
          <Image
            source={{ uri: PATTERN_URI }}
            style={[StyleSheet.absoluteFillObject, { opacity: 0.05 }]}
            contentFit="cover"
          />
        </View>
      )}

      <View
        style={[styles.headerOverlay, { zIndex: searchVisible ? 10000 : 100 }]}
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
      >
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

      <FlashList
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data={blocks as any}
        renderItem={renderItem}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        keyExtractor={(item: any, index: number) =>
          item.props?.id || `block-${index}`
        }
        ListHeaderComponent={renderListHeader}
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
        onClose={handleSearchCancel}
        topOffset={headerHeight}
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
