import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { resolveScrollHeaderVisibility } from '@/lib/scroll-header-visibility';
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
  const lastLoadMoreContentHeightRef = useRef(0);
  const hasExitedLoadMoreZoneRef = useRef(true);

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
  const isScrolledRef = useRef(false);
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

  const handleSearchSubmit = () => {
    Keyboard.dismiss();
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      lastLoadMoreContentHeightRef.current = 0;
      hasExitedLoadMoreZoneRef.current = true;
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const animateHeaderVisibility = (isVisible: boolean) => {
    Animated.timing(headerVisibility, {
      toValue: isVisible ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
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
    const normalizedOffsetY = Math.max(0, currentOffsetY);
    const currentContentHeight = event.nativeEvent.contentSize.height;
    const nextIsScrolled =
      normalizedOffsetY > HEADER_SOLID_BACKGROUND_OFFSET_PX;

    if (nextIsScrolled !== isScrolledRef.current) {
      isScrolledRef.current = nextIsScrolled;
      setIsScrolled(nextIsScrolled);
    }

    if (currentContentHeight < lastLoadMoreContentHeightRef.current) {
      lastLoadMoreContentHeightRef.current = 0;
      hasExitedLoadMoreZoneRef.current = true;
      headerScrollState.current.previousOffsetY = currentOffsetY;
    }

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
    const isNearBottom = distanceFromBottom <= HOME_LOAD_MORE_THRESHOLD_PX;

    if (!isNearBottom) {
      hasExitedLoadMoreZoneRef.current = true;
    }

    const hasNewContentHeight =
      contentSize.height > lastLoadMoreContentHeightRef.current;
    const canRetryCurrentHeight =
      hasExitedLoadMoreZoneRef.current &&
      contentSize.height === lastLoadMoreContentHeightRef.current;

    if (
      isScrollingDown &&
      isNearBottom &&
      (hasNewContentHeight || canRetryCurrentHeight)
    ) {
      lastLoadMoreContentHeightRef.current = contentSize.height;
      hasExitedLoadMoreZoneRef.current = false;
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
    lastLoadMoreContentHeightRef.current = 0;
    hasExitedLoadMoreZoneRef.current = true;
    headerScrollState.current.previousOffsetY = 0;
  }, [productGridDatasetKey]);

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
