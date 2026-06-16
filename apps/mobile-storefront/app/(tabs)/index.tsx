import { router, useIsFocused } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import {
  runOnJS,
  useAnimatedScrollHandler,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeScreenView } from '@/components/home/HomeScreenView';
import { getHomeProductGridSummary } from '@/components/home/home-product-grid-summary';
import { useHomePermissionPrompt } from '@/components/home/useHomePermissionPrompt';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import {
  getHomeContentBottomPadding,
  HOME_LOAD_MORE_THRESHOLD_PX,
} from '@/constants/layout';
import { usePageConfig } from '@/hooks';
import { useDeferredFocusRender } from '@/hooks/use-deferred-focus-render';
import { useNetworkState } from '@/hooks/use-network-state';
import { CONFIG } from '@/lib/config';
import { recordCrashBreadcrumb } from '@/lib/crash-diagnostics';
import { resolveHomeBlocks } from '@/lib/resolve-home-blocks';
import { getTemplateConfig } from '@/lib/templates';

const HEADER_SOLID_BACKGROUND_OFFSET_PX = 10;

const handleSearchSubmit = (): void => {
  Keyboard.dismiss();
};

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const lastHomeStateBreadcrumbRef = useRef<string | null>(null);

  const template = getTemplateConfig(CONFIG.BUSINESS_TYPE, CONFIG.TEMPLATE_ID);
  const isChatWidgetEnabled = template.features?.chatWidget ?? true;

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    template.headerStyle === 'elite' ? 'u-airtime' : null
  );
  const [productGridLoadMoreSignal, setProductGridLoadMoreSignal] = useState(0);

  const { handlePermissionDeny, handlePermissionGrant, showPermissionModal } =
    useHomePermissionPrompt();
  const shouldRenderDecorations = useDeferredFocusRender(isFocused);

  const {
    data: pageConfig,
    isLoading: isConfigLoading,
    refetch,
    isError,
  } = usePageConfig('home');

  const [refreshing, setRefreshing] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(150); // Initial estimate for spacer
  const [isScrolled, setIsScrolled] = useState(false);

  // Reanimated UI-thread values for continuous header folding calculations
  const headerVisibility = useSharedValue(1);
  const previousOffsetY = useSharedValue(0);
  const isScrolledShared = useSharedValue(false);
  const searchVisibleShared = useSharedValue(false);
  const lastLoadMoreContentHeight = useSharedValue(0);
  const hasExitedLoadMoreZone = useSharedValue(true);

  // 2026 Best Practice: Network state monitoring for offline UX
  // Note: Manual onReconnect refetch removed — onlineManager.setOnline(true)
  // combined with refetchOnReconnect: true handles automatic refetching.
  const { isOnline } = useNetworkState();

  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = () => {
    searchVisibleShared.set(true);
    headerVisibility.set(withTiming(1, { duration: 180 }));
    setSearchVisible(true);
  };

  const handleSearchCancel = () => {
    searchVisibleShared.set(false);
    setSearchVisible(false);
    setSearchQuery('');
  };

  const handleRefresh = () => {
    setRefreshing(true);
    lastLoadMoreContentHeight.set(0);
    hasExitedLoadMoreZone.set(true);
    previousOffsetY.set(0);
    return Promise.resolve(refetch()).finally(() => setRefreshing(false));
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

  const setIsScrolledJS = (nextScrolled: boolean) => {
    setIsScrolled(nextScrolled);
  };

  const triggerLoadMoreJS = () => {
    setProductGridLoadMoreSignal((current) => current + 1);
  };

  // C++ UI Thread scroll handler executing strictly in worklet thread context
  const handleListScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet';
      if (searchVisibleShared.get()) return;

      const currentOffsetY = event.contentOffset.y;
      const normalizedOffsetY = Math.max(0, currentOffsetY);
      const prevOffsetY = previousOffsetY.get();
      previousOffsetY.set(currentOffsetY);

      // Toggle solid background header state dynamically
      const nextScrolled =
        normalizedOffsetY > HEADER_SOLID_BACKGROUND_OFFSET_PX;
      if (nextScrolled !== isScrolledShared.get()) {
        isScrolledShared.set(nextScrolled);
        runOnJS(setIsScrolledJS)(nextScrolled);
      }

      // Sliding header collapse transitions
      if (currentOffsetY <= 0) {
        headerVisibility.set(withTiming(1, { duration: 180 }));
      } else if (currentOffsetY > prevOffsetY) {
        headerVisibility.set(withTiming(0, { duration: 180 }));
      } else if (prevOffsetY - currentOffsetY > 15) {
        // scroll tolerance/hysteresis
        headerVisibility.set(withTiming(1, { duration: 180 }));
      }

      // Infinite scroll load more detection at screen boundaries
      const distance =
        event.contentSize.height -
        (event.contentOffset.y + event.layoutMeasurement.height);
      const isInLoadMoreZone = distance <= HOME_LOAD_MORE_THRESHOLD_PX;
      if (!isInLoadMoreZone) {
        hasExitedLoadMoreZone.set(true);
      } else if (
        (currentOffsetY > prevOffsetY &&
          (hasExitedLoadMoreZone.get() ||
            event.contentSize.height > lastLoadMoreContentHeight.get() + 1)) ||
        event.contentSize.height < lastLoadMoreContentHeight.get() - 1
      ) {
        hasExitedLoadMoreZone.set(false);
        lastLoadMoreContentHeight.set(event.contentSize.height);
        runOnJS(triggerLoadMoreJS)();
      }
    },
  });

  const handleCategorySelect = (id: string | null) => {
    if (id?.startsWith('u-')) {
      setSelectedCategoryId(id);
      // 2026 Best Practice: Route to Guest Utility Flow
      const type = id.replace('u-', '');
      router.push(`/utilities/${type}` as never);
      return;
    }
    setSelectedCategoryId(id);
  };

  const blocks = resolveHomeBlocks(
    pageConfig?.content,
    template.headerStyle === 'elite',
    isConfigLoading && !pageConfig
  );
  const {
    primaryProductGridIndex,
    productGridBlockCount,
    productGridDatasetKey,
  } = getHomeProductGridSummary(blocks, selectedCategoryId);
  const hasPageConfig = Boolean(pageConfig);

  useEffect(() => {
    void productGridDatasetKey;
    lastLoadMoreContentHeight.set(0);
    hasExitedLoadMoreZone.set(true);
    previousOffsetY.set(0);
  }, [
    hasExitedLoadMoreZone,
    lastLoadMoreContentHeight,
    previousOffsetY,
    productGridDatasetKey,
  ]);

  useEffect(() => {
    recordCrashBreadcrumb('home:mounted', {
      businessType: CONFIG.BUSINESS_TYPE,
      templateId: CONFIG.TEMPLATE_ID,
    });
    return () => recordCrashBreadcrumb('home:unmounted');
  }, []);

  useEffect(() => {
    const stateSignature = JSON.stringify({
      blockCount: blocks.length,
      hasPageConfig,
      isError,
      isFocused,
      primaryProductGridIndex,
      productGridBlockCount,
      selectedCategoryId,
    });

    if (lastHomeStateBreadcrumbRef.current === stateSignature) {
      return;
    }

    lastHomeStateBreadcrumbRef.current = stateSignature;
    recordCrashBreadcrumb('home:state', {
      blockCount: blocks.length,
      hasPageConfig,
      isError,
      isFocused,
      primaryProductGridIndex,
      productGridBlockCount,
      selectedCategoryId,
    });
  }, [
    blocks.length,
    hasPageConfig,
    isError,
    isFocused,
    primaryProductGridIndex,
    productGridBlockCount,
    selectedCategoryId,
  ]);

  const resolvedHeaderHeight = headerHeight > 0 ? headerHeight : 150;
  const isElite = template.headerStyle === 'elite';
  const homeContentBottomPadding = getHomeContentBottomPadding(
    insets.bottom,
    isChatWidgetEnabled
  );

  return (
    <HomeScreenView
      backgroundColor={colors.background}
      blackColor={colors.black}
      blocks={blocks}
      contentBottomPadding={homeContentBottomPadding}
      hasPageConfig={hasPageConfig}
      headerVisibility={headerVisibility}
      isConfigLoading={isConfigLoading && !refreshing}
      isElite={isElite}
      isError={isError}
      isOnline={isOnline}
      isScrolled={isScrolled}
      onCategorySelect={handleCategorySelect}
      onHeaderLayout={handleHeaderLayout}
      onListScroll={handleListScroll}
      onPermissionDeny={handlePermissionDeny}
      onPermissionGrant={handlePermissionGrant}
      onRefresh={handleRefresh}
      onSearch={handleSearch}
      onSearchCancel={handleSearchCancel}
      onSearchQueryChange={setSearchQuery}
      onSearchSubmit={handleSearchSubmit}
      primaryColor={colors.primary}
      primaryProductGridIndex={primaryProductGridIndex}
      productGridLoadMoreSignal={productGridLoadMoreSignal}
      refreshing={refreshing}
      resolvedHeaderHeight={resolvedHeaderHeight}
      searchQuery={searchQuery}
      searchVisible={searchVisible}
      selectedCategoryId={selectedCategoryId}
      shouldRenderDecorations={shouldRenderDecorations}
      showPermissionModal={showPermissionModal}
    />
  );
}
