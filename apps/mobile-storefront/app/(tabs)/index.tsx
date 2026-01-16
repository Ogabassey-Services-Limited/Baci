import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, StatusBar, StyleSheet, View } from 'react-native';
import { BlockRenderer } from '@/components/storefront/BlockRenderer';
import { Header } from '@/components/storefront/Header';
import { HeroSkeleton, ProductGridSkeleton } from '@/components/ui/Skeleton';
import { SnowEffect } from '@/components/ui/SnowEffect';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import { usePageConfig } from '@/hooks/use-products-query';

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null
  );
  const { data: pageConfig, isLoading: isConfigLoading } =
    usePageConfig('home');
  const [refreshing, setRefreshing] = React.useState(false);

  const handleSearch = useCallback(() => {
    router.push('/search');
  }, []);

  const handleCategorySelect = (id: string | null) => {
    setSelectedCategoryId(id);
  };

  // Default "Elite" layout if no config exists
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

  const blocks = (pageConfig?.content || defaultBlocks) as any[];

  if (isConfigLoading && !refreshing) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header showSearch={true} />
        <HeroSkeleton />
        <ProductGridSkeleton count={4} />
      </View>
    );
  }

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <StatusBar barStyle="light-content" />
      <Header showSearch={true} onSearchPress={handleSearch} />

      <BlockRenderer
        blocks={blocks}
        selectedCategoryId={selectedCategoryId}
        onCategorySelect={handleCategorySelect}
      />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SnowEffect />
      <FlashList
        data={[]}
        renderItem={() => null}
        ListHeaderComponent={renderHeader}
        estimatedItemSize={1000}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => setRefreshing(false)}
            tintColor={BRAND.primary}
            colors={[BRAND.primary]}
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
});
