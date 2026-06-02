import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useSharedValue,
  useAnimatedScrollHandler,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { HomeScreenView } from '@/components/home/HomeScreenView';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import {
  getHomeContentBottomPadding,
  HOME_LOAD_MORE_THRESHOLD_PX,
} from '@/constants/layout';
import { usePageConfig } from '@/hooks';
import { useNetworkState } from '@/hooks/use-network-state';
import { usePermissionBooster } from '@/hooks/use-permission-booster';
import { CONFIG } from '@/lib/config';
import { resolveHomeBlocks } from '@/lib/resolve-home-blocks';
import { getTemplateConfig } from '@/lib/templates';

const HEADER_SOLID_BACKGROUND_OFFSET_PX = 10;

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
    headerVisibility.value = withTiming(1, { duration: 180 });
    setSearchVisible(true);
  };

  const handleSearchCancel = () => {
    searchVisibleShared.set(false);
    setSearchVisible(false);
    setSearchQuery('');
  };

  const handleSearchSubmit = () => {
    Keyboard.dismiss();
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      lastLoadMoreContentHeight.value = 0;
      hasExitedLoadMoreZone.value = true;
      previousOffsetY.value = 0;
      await refetch();
    } finally {
      setRefreshing(false);
    }
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
      if (searchVisibleShared.value) return;

      const currentOffsetY = event.contentOffset.y;
      const normalizedOffsetY = Math.max(0, currentOffsetY);
      const prevOffsetY = previousOffsetY.value;
      previousOffsetY.value = currentOffsetY;

      // Toggle solid background header state dynamically
      const nextScrolled =
        normalizedOffsetY > HEADER_SOLID_BACKGROUND_OFFSET_PX;
      if (nextScrolled !== isScrolledShared.value) {
        isScrolledShared.value = nextScrolled;
        runOnJS(setIsScrolledJS)(nextScrolled);
      }

      // Sliding header collapse transitions
      if (currentOffsetY <= 0) {
        headerVisibility.value = withTiming(1, { duration: 180 });
      } else if (currentOffsetY > prevOffsetY) {
        headerVisibility.value = withTiming(0, { duration: 180 });
      } else if (prevOffsetY - currentOffsetY > 15) {
        // scroll tolerance/hysteresis
        headerVisibility.value = withTiming(1, { duration: 180 });
      }

      // Infinite scroll load more detection at screen boundaries
      const distance =
        event.contentSize.height -
        (event.contentOffset.y + event.layoutMeasurement.height);
      const isInLoadMoreZone = distance <= HOME_LOAD_MORE_THRESHOLD_PX;
      if (!isInLoadMoreZone) {
        hasExitedLoadMoreZone.value = true;
      } else if (
        (currentOffsetY > prevOffsetY &&
          (hasExitedLoadMoreZone.value ||
            event.contentSize.height > lastLoadMoreContentHeight.value + 1)) ||
        event.contentSize.height < lastLoadMoreContentHeight.value - 1
      ) {
        hasExitedLoadMoreZone.value = false;
        lastLoadMoreContentHeight.value = event.contentSize.height;
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
  const productGridDatasetKey = JSON.stringify({
    selectedCategoryId,
    productGridBlockIds: blocks
      .filter((block) => block.type === 'ProductGrid')
      .map((block) => block.props.id ?? block.type),
  });
  const primaryProductGridId =
    blocks.find((block) => block.type === 'ProductGrid')?.props.id ?? null;
  const primaryProductGridIndex = (() => {
    if (primaryProductGridId) {
      const matchingGridIndex = blocks.findIndex(
        (block) =>
          block.type === 'ProductGrid' &&
          block.props.id === primaryProductGridId
      );
      if (matchingGridIndex !== -1) {
        return matchingGridIndex;
      }
    }

    return blocks.findIndex((block) => block.type === 'ProductGrid');
  })();

  useEffect(() => {
    void productGridDatasetKey;
    lastLoadMoreContentHeight.value = 0;
    hasExitedLoadMoreZone.value = true;
    previousOffsetY.value = 0;
  }, [
    hasExitedLoadMoreZone,
    lastLoadMoreContentHeight,
    previousOffsetY,
    productGridDatasetKey,
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
      hasPageConfig={Boolean(pageConfig)}
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
      primaryProductGridIndex={primaryProductGridIndex}
      productGridLoadMoreSignal={productGridLoadMoreSignal}
      refreshing={refreshing}
      resolvedHeaderHeight={resolvedHeaderHeight}
      searchQuery={searchQuery}
      searchVisible={searchVisible}
      selectedCategoryId={selectedCategoryId}
      showPermissionModal={showPermissionModal}
    />
  );
}
