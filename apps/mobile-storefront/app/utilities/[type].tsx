import { useQueryClient } from '@tanstack/react-query';
import { type Href, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { InvalidUtilityServiceView } from '@/app/utilities/InvalidUtilityServiceView';
import { QuickRepeatPrompt } from '@/app/utilities/QuickRepeatPrompt';
import { UtilityHeader } from '@/app/utilities/UtilityHeader';
import { UtilityPurchaseSuccessView } from '@/app/utilities/UtilityPurchaseSuccessView';
import { useQuickRepeat } from '@/app/utilities/use-quick-repeat';
import {
  isBillUtilityType,
  isValidUtilityType,
  UTILITY_TYPE_TITLES,
} from '@/app/utilities/utility-purchase.config';
import { utilityPurchaseStyles as styles } from '@/app/utilities/utility-purchase.styles';
import type {
  RawRouteRepeatParams,
  UtilityPurchaseResult,
  ValidUtilityType,
} from '@/app/utilities/utility-purchase.types';
import { useColorScheme } from '@/components/useColorScheme';
import { AirtimeForm } from '@/components/utilities/AirtimeForm';
import { BillForm } from '@/components/utilities/BillForm';
import { DataForm } from '@/components/utilities/DataForm';
import { UtilityTypeTabs } from '@/components/utilities/UtilityTypeTabs';
import Colors from '@/constants/Colors';
import {
  NETWORK_PROVIDERS,
  type NetworkProviderId,
} from '@/constants/network-providers';
import { useKeyboard } from '@/hooks/use-keyboard';
import { walletKeys } from '@/hooks/use-wallet';
import { CONFIG } from '@/lib/config';
import { RouteRepeatParamsSchema } from '@/schemas/utility-purchase';
import { useAuthStore } from '@/stores/auth-store';

interface UtilityRouteParams extends RawRouteRepeatParams {
  type: string;
  paymentStatus?: string;
  reference?: string;
  amount?: string;
  customerIdentifier?: string;
  cashbackAmount?: string;
  cashbackNewBalance?: string;
  voucherPin?: string;
}

type UtilityRouteSuccessData = Omit<UtilityPurchaseResult, 'voucherPin'> & {
  voucherPin: string | null;
};

type UtilityRouteParamKey = keyof UtilityRouteParams;

const UTILITY_ROUTE_PARAM_KEYS = [
  'amount',
  'cashbackAmount',
  'cashbackNewBalance',
  'customerIdentifier',
  'paymentStatus',
  'reference',
  'repeatAmount',
  'repeatBillerName',
  'repeatBillItemIdentifier',
  'repeatCustomerIdentifier',
  'repeatCustomerName',
  'repeatDataPlanCode',
  'repeatNetworkProvider',
  'repeatPhoneNumber',
  'repeatVerified',
  'type',
  'voucherPin',
] as const satisfies readonly UtilityRouteParamKey[];

const QUICK_REPEAT_BOTTOM_OFFSET = 92; // Keeps the prompt above fixed payment controls.
const QUICK_REPEAT_PROMPT_HEIGHT = 68; // Approximate rendered height of the QuickRepeatPrompt banner.

function getNetworkProviderId(
  value: string | undefined
): NetworkProviderId | undefined {
  return NETWORK_PROVIDERS.find((provider) => provider.id === value)?.id;
}

function safeParseNumber(value: string | undefined, fallback = 0) {
  if (typeof value !== 'string') {
    return fallback;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getSearchParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getParamSuccessData(
  params: UtilityRouteParams
): UtilityRouteSuccessData | null {
  const hasPaymentStatus =
    params.paymentStatus === 'successful' ||
    params.paymentStatus === 'processing';
  if (!hasPaymentStatus || !params.reference) {
    return null;
  }

  return {
    amount: safeParseNumber(params.amount),
    cashback:
      params.cashbackAmount && params.cashbackNewBalance
        ? {
            amount: safeParseNumber(params.cashbackAmount),
            newBalance: safeParseNumber(params.cashbackNewBalance),
          }
        : undefined,
    customerIdentifier: params.customerIdentifier,
    reference: params.reference,
    status: params.paymentStatus as 'processing' | 'successful',
    voucherPin: params.voucherPin ?? null,
  };
}

export default function UtilityPurchaseScreen() {
  const rawParams =
    useLocalSearchParams<
      Partial<Record<UtilityRouteParamKey, string | string[]>>
    >();
  const params = UTILITY_ROUTE_PARAM_KEYS.reduce<UtilityRouteParams>(
    (routeParams, key) => {
      const value = getSearchParamValue(rawParams[key]);

      if (key === 'type') {
        routeParams.type = value ?? '';
        return routeParams;
      }

      routeParams[key] = value;

      return routeParams;
    },
    { type: '' }
  );
  const repeatParamsResult = RouteRepeatParamsSchema.safeParse(params);
  const repeatParams = repeatParamsResult.success
    ? repeatParamsResult.data
    : {};
  const queryClient = useQueryClient();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const { isKeyboardVisible } = useKeyboard();
  const headerOffset = Math.max(insets.top, 42);
  const quickRepeatScrollCompensation =
    Math.max(insets.bottom, 12) + QUICK_REPEAT_BOTTOM_OFFSET;
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
  const currentType = selectedType ?? routeType;
  const historyFilter = currentType ?? 'airtime';
  const title = currentType ? UTILITY_TYPE_TITLES[currentType] : 'Utility';
  const quickRepeat = useQuickRepeat({
    currentType,
    historyFilter,
    isKeyboardVisible,
    ...repeatParams,
    routeType,
    title,
  });
  const resolvedSuccessData = successData ?? getParamSuccessData(params);
  const successCashbackAmount = resolvedSuccessData?.cashback?.amount ?? 0;
  const successReference = resolvedSuccessData?.reference;

  useEffect(() => {
    if (routeType) {
      setSelectedType(routeType);
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
    }
  };

  if (!routeType || !currentType) {
    return (
      <InvalidUtilityServiceView
        colors={colors}
        onBack={handleGoBack}
        topInset={insets.top}
      />
    );
  }

  if (resolvedSuccessData) {
    return (
      <UtilityPurchaseSuccessView
        bottomPadding={Math.max(insets.bottom - 12, 0)}
        colors={colors}
        data={resolvedSuccessData}
        headerOffset={headerOffset}
        isAuthenticated={isAuthenticated}
        onCreateAccount={() => router.push('/auth/login')}
        type={currentType}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={headerOffset}
        style={styles.container}
      >
        <UtilityTypeTabs
          selectedType={currentType}
          onSelect={handleUtilityTypeChange}
        />
        {currentType === 'airtime' ? (
          <AirtimeForm
            key={`airtime-${quickRepeat.repeatRevision}`}
            initialAmount={quickRepeat.repeatDefaults.amount}
            initialPhoneNumber={quickRepeat.repeatDefaults.phoneNumber}
            initialProvider={getNetworkProviderId(
              quickRepeat.repeatDefaults.networkProvider
            )}
            isRepeatPaymentReady={quickRepeat.isRepeatPaymentReady}
            onSuccess={setSuccessData}
          />
        ) : null}
        {currentType === 'data' ? (
          <DataForm
            key={`data-${quickRepeat.repeatRevision}`}
            initialAmount={quickRepeat.repeatDefaults.amount}
            initialPhoneNumber={quickRepeat.repeatDefaults.phoneNumber}
            initialPlan={quickRepeat.repeatDefaults.dataPlanCode}
            initialProvider={quickRepeat.repeatDefaults.networkProvider}
            isRepeatPaymentReady={quickRepeat.isRepeatPaymentReady}
            onSuccess={setSuccessData}
          />
        ) : null}
        {isBillUtilityType(currentType) ? (
          <BillForm
            key={`${currentType}-${quickRepeat.repeatRevision}`}
            initialAmount={quickRepeat.repeatDefaults.amount}
            initialBillerName={quickRepeat.repeatDefaults.billerName}
            initialBillItemIdentifier={
              quickRepeat.repeatDefaults.billItemIdentifier
            }
            initialCustomerIdentifier={
              quickRepeat.repeatDefaults.customerIdentifier
            }
            initialCustomerName={quickRepeat.repeatDefaults.customerName}
            isRepeatPaymentReady={quickRepeat.isRepeatPaymentReady}
            type={currentType}
            onSuccess={setSuccessData}
            extraScrollPadding={
              quickRepeat.showQuickRepeat
                ? quickRepeatScrollCompensation + QUICK_REPEAT_PROMPT_HEIGHT
                : 0
            }
          />
        ) : null}
      </KeyboardAvoidingView>
      <QuickRepeatPrompt
        bottom={quickRepeatScrollCompensation}
        colors={colors}
        isLoading={quickRepeat.isRecentTransactionsLoading}
        lastTransaction={quickRepeat.lastTransaction}
        notice={quickRepeat.quickRepeatNotice}
        onQuickRepeat={quickRepeat.handleQuickRepeat}
        showQuickRepeat={quickRepeat.showQuickRepeat}
        title={title}
      />
    </View>
  );
}
