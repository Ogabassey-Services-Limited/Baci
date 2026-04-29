import { type Href, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/components/useColorScheme';
import { AirtimeForm } from '@/components/utilities/AirtimeForm';
import { BillForm } from '@/components/utilities/BillForm';
import { DataForm } from '@/components/utilities/DataForm';
import { UtilityTypeTabs } from '@/components/utilities/UtilityTypeTabs';
import Colors from '@/constants/Colors';
import { useKeyboard } from '@/hooks/use-keyboard';
import { useAuthStore } from '@/stores/auth-store';
import { InvalidUtilityServiceView } from './InvalidUtilityServiceView';
import { QuickRepeatPrompt } from './QuickRepeatPrompt';
import { UtilityHeader } from './UtilityHeader';
import { UtilityPurchaseSuccessView } from './UtilityPurchaseSuccessView';
import {
  isValidUtilityType,
  UTILITY_TYPE_TITLES,
} from './utility-purchase.config';
import { utilityPurchaseStyles as styles } from './utility-purchase.styles';
import type {
  RouteRepeatParams,
  SuccessData,
  ValidUtilityType,
} from './utility-purchase.types';
import { useQuickRepeat } from './use-quick-repeat';

interface UtilityRouteParams extends RouteRepeatParams {
  type: string;
  paymentStatus?: string;
  reference?: string;
  amount?: string;
  customerIdentifier?: string;
  cashbackAmount?: string;
  cashbackNewBalance?: string;
  voucherPin?: string;
}

function getParamSuccessData(params: UtilityRouteParams): SuccessData | null {
  const hasPaymentStatus =
    params.paymentStatus === 'successful' ||
    params.paymentStatus === 'processing';
  if (!hasPaymentStatus || !params.reference) {
    return null;
  }

  return {
    amount: Number(params.amount ?? 0),
    cashback:
      params.cashbackAmount && params.cashbackNewBalance
        ? {
            amount: Number(params.cashbackAmount),
            newBalance: Number(params.cashbackNewBalance),
          }
        : undefined,
    customerIdentifier: params.customerIdentifier,
    reference: params.reference,
    status: params.paymentStatus as 'processing' | 'successful',
    voucherPin: params.voucherPin,
  };
}

export default function UtilityPurchaseScreen() {
  const params = useLocalSearchParams<
    Record<string, string>
  >() as unknown as UtilityRouteParams;
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const { isKeyboardVisible } = useKeyboard();
  const headerOffset = Math.max(insets.top, 42);
  const isAuthenticated = useAuthStore((state) => !!state.session);
  const routeType =
    params.type && isValidUtilityType(params.type) ? params.type : null;
  const [successData, setSuccessData] = useState<SuccessData | null>(null);
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
    repeatAmount: params.repeatAmount,
    repeatBillerName: params.repeatBillerName,
    repeatBillItemIdentifier: params.repeatBillItemIdentifier,
    repeatCustomerIdentifier: params.repeatCustomerIdentifier,
    repeatDataPlanCode: params.repeatDataPlanCode,
    repeatNetworkProvider: params.repeatNetworkProvider,
    repeatPhoneNumber: params.repeatPhoneNumber,
    repeatVerified: params.repeatVerified,
    routeType,
    title,
  });

  useEffect(() => {
    if (routeType) {
      setSelectedType(routeType);
    }
  }, [routeType]);

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/' as Href);
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

  const resolvedSuccessData = successData ?? getParamSuccessData(params);
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

  const handleUtilityTypeChange = (nextType: ValidUtilityType) => {
    if (nextType !== currentType) {
      setSelectedType(nextType);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <UtilityHeader
        title={title}
        onBack={handleGoBack}
        onHistory={() =>
          router.push(`/utilities/history?type=${currentType}` as Href)
        }
        color={colors.text}
        dividerColor={colors.border}
        iconBackgroundColor={colors.card}
        iconColor={colors.text}
        topInset={insets.top}
        surfaceColor={colors.background}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={headerOffset}
        style={styles.flex}
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
            initialProvider={quickRepeat.repeatDefaults.networkProvider}
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
        {currentType === 'tv' ||
        currentType === 'power' ||
        currentType === 'gaming' ? (
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
            isRepeatPaymentReady={quickRepeat.isRepeatPaymentReady}
            type={currentType as 'tv' | 'power' | 'gaming'}
            onSuccess={setSuccessData}
          />
        ) : null}
      </KeyboardAvoidingView>
      <QuickRepeatPrompt
        bottom={Math.max(insets.bottom, 12) + 92}
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
