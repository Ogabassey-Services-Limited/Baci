import { useQueryClient } from '@tanstack/react-query';
import { type Href, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StorefrontScreenShell } from '@/components/storefront/StorefrontScreenShell';
import AppKeyboardContainer from '@/components/ui/AppKeyboardContainer';
import { useColorScheme } from '@/components/useColorScheme';
import { InvalidUtilityServiceView } from '@/components/utilities/InvalidUtilityServiceView';
import { UtilityHeader } from '@/components/utilities/UtilityHeader';
import {
  type UtilityPurchasePagerHandle,
  UtilityPurchasePager,
} from '@/components/utilities/UtilityPurchasePager';
import { UtilityPurchaseSuccessView } from '@/components/utilities/UtilityPurchaseSuccessView';
import { UtilityTypeTabs } from '@/components/utilities/UtilityTypeTabs';
import { useQuickRepeat } from '@/components/utilities/use-quick-repeat';
import {
  isValidUtilityType,
  UTILITY_TYPE_TITLES,
} from '@/components/utilities/utility-purchase.config';
import {
  getParamSuccessData,
  toUtilityRouteParams,
  type UtilityRouteParamKey,
} from '@/components/utilities/utility-purchase.route-params';
import { utilityPurchaseStyles as styles } from '@/components/utilities/utility-purchase.styles';
import type {
  UtilityPurchaseResult,
  ValidUtilityType,
} from '@/components/utilities/utility-purchase.types';
import Colors from '@/constants/Colors';
import { walletKeys } from '@/hooks/use-wallet';
import { CONFIG } from '@/lib/config';
import { RouteRepeatParamsSchema } from '@/schemas/utility-purchase';
import { useAuthStore } from '@/stores/auth-store';

const UTILITY_TYPE_INDEXES: Record<ValidUtilityType, number> = {
  airtime: 0,
  data: 1,
  tv: 2,
  power: 3,
  gaming: 4,
};

const INDEX_TO_UTILITY_TYPE: readonly ValidUtilityType[] = [
  'airtime',
  'data',
  'tv',
  'power',
  'gaming',
];

export default function UtilityPurchaseScreen() {
  const rawParams =
    useLocalSearchParams<
      Partial<Record<UtilityRouteParamKey, string | string[]>>
    >();
  const params = toUtilityRouteParams(rawParams);
  const repeatParamsResult = RouteRepeatParamsSchema.safeParse(params);
  const repeatParams = repeatParamsResult.success
    ? repeatParamsResult.data
    : {};
  const queryClient = useQueryClient();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const headerOffset = Math.max(insets.top, 42);
  const isAuthenticated = useAuthStore((state) => !!state.session);
  const customerId = useAuthStore((state) => state.customer?.id);
  const merchantId = useAuthStore((state) => state.merchantId);
  const activeMerchantId = merchantId || CONFIG.MERCHANT_ID;
  const routeType =
    params.type && isValidUtilityType(params.type) ? params.type : null;
  const [successData, setSuccessData] = useState<UtilityPurchaseResult | null>(
    null
  );
  const [selectedType, setSelectedType] = useState<ValidUtilityType | null>(
    routeType
  );
  const [visitedTypes, setVisitedTypes] = useState<
    Record<ValidUtilityType, boolean>
  >(() => ({
    airtime: routeType === 'airtime',
    data: routeType === 'data',
    tv: routeType === 'tv',
    power: routeType === 'power',
    gaming: routeType === 'gaming',
  }));
  const currentType = selectedType ?? routeType;
  const historyFilter = currentType ?? 'airtime';
  const title = currentType ? UTILITY_TYPE_TITLES[currentType] : 'Utility';
  const quickRepeat = useQuickRepeat({
    currentType,
    historyFilter,
    ...repeatParams,
    routeType,
  });
  const resolvedSuccessData = successData ?? getParamSuccessData(params);
  const successCashbackAmount = resolvedSuccessData?.cashback?.amount ?? 0;
  const successReference = resolvedSuccessData?.reference;

  const pagerRef = useRef<UtilityPurchasePagerHandle | null>(null);

  const handlePageSelected = (event: { nativeEvent: { position: number } }) => {
    const newIndex = event.nativeEvent.position;
    const newType = INDEX_TO_UTILITY_TYPE[newIndex];
    if (!newType) {
      return;
    }

    if (newType !== selectedType) {
      setSelectedType(newType);
    }
  };

  useEffect(() => {
    if (currentType) {
      setVisitedTypes((prev) =>
        prev[currentType] ? prev : { ...prev, [currentType]: true }
      );
    }
  }, [currentType]);

  useEffect(() => {
    if (routeType) {
      setSelectedType(routeType);
      const nextIndex = UTILITY_TYPE_INDEXES[routeType];
      pagerRef.current?.setPage(nextIndex);
    }
  }, [routeType]);

  useEffect(() => {
    if (
      !currentType ||
      !customerId ||
      !successReference ||
      successCashbackAmount <= 0
    ) {
      return;
    }

    void queryClient.invalidateQueries({
      queryKey: walletKeys.data({
        merchantId: activeMerchantId,
        ownerId: customerId,
      }),
    });
  }, [
    activeMerchantId,
    currentType,
    customerId,
    queryClient,
    successCashbackAmount,
    successReference,
  ]);

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/' as Href);
  };

  const handleUtilityTypeChange = (nextType: ValidUtilityType) => {
    if (nextType !== currentType) {
      setSelectedType(nextType);
      const nextIndex = UTILITY_TYPE_INDEXES[nextType];
      pagerRef.current?.setPage(nextIndex);
    }
  };

  if (!routeType || !currentType) {
    return (
      <StorefrontScreenShell
        edges={[]}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <InvalidUtilityServiceView
          colors={colors}
          onBack={handleGoBack}
          topInset={insets.top}
        />
      </StorefrontScreenShell>
    );
  }

  if (resolvedSuccessData) {
    return (
      <StorefrontScreenShell
        edges={[]}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <UtilityPurchaseSuccessView
          bottomPadding={Math.max(insets.bottom - 12, 0)}
          colors={colors}
          data={resolvedSuccessData}
          headerOffset={headerOffset}
          isAuthenticated={isAuthenticated}
          onCreateAccount={() => router.push('/auth/login')}
          type={currentType}
        />
      </StorefrontScreenShell>
    );
  }

  return (
    <StorefrontScreenShell
      edges={[]}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <UtilityHeader
        title={title}
        onBack={handleGoBack}
        onHistory={() =>
          router.push(`/utilities/history?type=${currentType}` as Href)
        }
        titleColor={colors.text}
        dividerColor={colors.border}
        iconBackgroundColor={colors.card}
        iconColor={colors.text}
        topInset={insets.top}
        surfaceColor={colors.background}
      />
      <AppKeyboardContainer enabled={false} style={styles.container}>
        <UtilityTypeTabs
          selectedType={currentType}
          onSelect={handleUtilityTypeChange}
        />
        <UtilityPurchasePager
          currentType={currentType}
          initialPage={UTILITY_TYPE_INDEXES[currentType]}
          onPageSelected={handlePageSelected}
          onSuccess={setSuccessData}
          pagerRef={pagerRef}
          quickRepeat={quickRepeat}
          visitedTypes={visitedTypes}
        />
      </AppKeyboardContainer>
    </StorefrontScreenShell>
  );
}
