import { Ionicons } from '@expo/vector-icons';
import { type Href, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/components/useColorScheme';
import { AirtimeForm } from '@/components/utilities/AirtimeForm';
import { BillForm } from '@/components/utilities/BillForm';
import { DataForm } from '@/components/utilities/DataForm';
import { PurchaseSuccess } from '@/components/utilities/PurchaseSuccess';
import { UtilityTypeTabs } from '@/components/utilities/UtilityTypeTabs';
import {
  type UtilityRepeatDefaults,
  utilityRepeatHelpers,
} from '@/lib/utility-repeat';
import Colors from '@/constants/Colors';
import { useKeyboard } from '@/hooks/use-keyboard';
import { useVTUHistory } from '@/hooks/use-vtu-history';
import { useAuthStore } from '@/stores/auth-store';

interface CashbackInfo {
  amount: number;
  newBalance: number;
}

interface SuccessData {
  reference: string;
  amount: number;
  customerIdentifier?: string;
  cashback?: CashbackInfo;
  status?: 'processing' | 'successful';
  voucherPin?: string;
}

const VALID_TYPES = ['airtime', 'data', 'tv', 'power', 'gaming'] as const;
type ValidType = (typeof VALID_TYPES)[number];

function isValidType(value: string): value is ValidType {
  return (VALID_TYPES as readonly string[]).includes(value);
}

const TYPE_TITLES: Record<ValidType, string> = {
  airtime: 'Airtime',
  data: 'Data',
  tv: 'TV',
  power: 'Electricity',
  gaming: 'Betting',
};

function getRouteRepeatDefaults(params: {
  repeatAmount?: string;
  repeatBillerName?: string;
  repeatBillItemIdentifier?: string;
  repeatCustomerIdentifier?: string;
  repeatDataPlanCode?: string;
  repeatNetworkProvider?: string;
  repeatPhoneNumber?: string;
  repeatVerified?: string;
}): UtilityRepeatDefaults {
  return {
    amount: params.repeatAmount,
    billerName: params.repeatBillerName,
    billItemIdentifier: params.repeatBillItemIdentifier,
    customerIdentifier: params.repeatCustomerIdentifier,
    dataPlanCode: params.repeatDataPlanCode,
    isVerified: params.repeatVerified === '1',
    networkProvider: params.repeatNetworkProvider,
    phoneNumber: params.repeatPhoneNumber,
  };
}

function UtilityHeader({
  title,
  onBack,
  onHistory,
  color,
  dividerColor,
  iconBackgroundColor,
  iconColor,
  topInset,
  surfaceColor,
}: {
  title: string;
  onBack: () => void;
  onHistory?: () => void;
  color: string;
  dividerColor: string;
  iconBackgroundColor: string;
  iconColor: string;
  topInset: number;
  surfaceColor: string;
}) {
  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: surfaceColor,
          borderBottomColor: dividerColor,
          paddingTop: Math.max(topInset - 10, 12),
        },
      ]}
    >
      <View style={styles.headerSide}>
        <Pressable
          style={styles.headerIconButton}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <View
            style={[
              styles.headerIconCircle,
              { backgroundColor: iconBackgroundColor },
            ]}
          >
            <Ionicons name="chevron-back" size={31} color={iconColor} />
          </View>
        </Pressable>
      </View>

      <View style={styles.headerTitleWrap}>
        <Text style={[styles.headerTitle, { color }]} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <View style={[styles.headerSide, styles.headerSideRight]}>
        {onHistory ? (
          <Pressable
            style={styles.headerIconButton}
            onPress={onHistory}
            accessibilityRole="button"
            accessibilityLabel="View utility history"
          >
            <View
              style={[
                styles.headerIconCircle,
                { backgroundColor: iconBackgroundColor },
              ]}
            >
              <Ionicons
                name="document-text-outline"
                size={25}
                color={iconColor}
              />
            </View>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default function UtilityPurchaseScreen() {
  const params = useLocalSearchParams<{
    type: string;
    paymentStatus?: string;
    reference?: string;
    amount?: string;
    customerIdentifier?: string;
    cashbackAmount?: string;
    cashbackNewBalance?: string;
    repeatAmount?: string;
    repeatBillerName?: string;
    repeatBillItemIdentifier?: string;
    repeatCustomerIdentifier?: string;
    repeatDataPlanCode?: string;
    repeatNetworkProvider?: string;
    repeatPhoneNumber?: string;
    repeatVerified?: string;
    voucherPin?: string;
  }>();
  const {
    repeatAmount,
    repeatBillerName,
    repeatBillItemIdentifier,
    repeatCustomerIdentifier,
    repeatDataPlanCode,
    repeatNetworkProvider,
    repeatPhoneNumber,
    repeatVerified,
    type,
  } = params;
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const { isKeyboardVisible } = useKeyboard();
  const headerOffset = Math.max(insets.top, 42);
  const isAuthenticated = useAuthStore((state) => !!state.session);
  const routeType = type && isValidType(type) ? type : null;

  const [successData, setSuccessData] = useState<SuccessData | null>(null);
  const [selectedType, setSelectedType] = useState<ValidType | null>(routeType);
  const historyFilter = selectedType ?? routeType ?? 'airtime';
  const routeRepeatDefaults = getRouteRepeatDefaults({
    repeatAmount,
    repeatBillerName,
    repeatBillItemIdentifier,
    repeatCustomerIdentifier,
    repeatDataPlanCode,
    repeatNetworkProvider,
    repeatPhoneNumber,
    repeatVerified,
  });
  const currentType = selectedType ?? routeType;
  const [repeatDefaults, setRepeatDefaults] = useState<UtilityRepeatDefaults>(
    routeType ? routeRepeatDefaults : {}
  );
  const [repeatRevision, setRepeatRevision] = useState(0);
  const [isQuickRepeatDismissed, setIsQuickRepeatDismissed] = useState(false);
  const {
    data: recentTransactions,
    error: recentTransactionsError,
    isLoading: isRecentTransactionsLoading,
  } = useVTUHistory(historyFilter, 1);

  useEffect(() => {
    if (routeType) {
      setSelectedType(routeType);
    }
  }, [routeType]);

  useEffect(() => {
    setRepeatDefaults(
      routeType && currentType === routeType
        ? getRouteRepeatDefaults({
            repeatAmount,
            repeatBillerName,
            repeatBillItemIdentifier,
            repeatCustomerIdentifier,
            repeatDataPlanCode,
            repeatNetworkProvider,
            repeatPhoneNumber,
            repeatVerified,
          })
        : {}
    );
    setRepeatRevision(0);
    setIsQuickRepeatDismissed(false);
  }, [
    currentType,
    routeType,
    repeatAmount,
    repeatBillerName,
    repeatBillItemIdentifier,
    repeatCustomerIdentifier,
    repeatDataPlanCode,
    repeatNetworkProvider,
    repeatPhoneNumber,
    repeatVerified,
  ]);

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/' as Href);
  };

  // Bug #59: Validate the type param instead of silently defaulting to 'airtime'
  if (!routeType) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <UtilityHeader
          title="Invalid Service"
          onBack={handleGoBack}
          color={colors.text}
          dividerColor={colors.border}
          iconBackgroundColor={colors.card}
          iconColor={colors.text}
          topInset={insets.top}
          surfaceColor={colors.background}
        />
        <View style={styles.errorContainer}>
          <Text style={[styles.errorTitle, { color: colors.text }]}>
            Service Not Found
          </Text>
          <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>
            The requested utility service is not available.
          </Text>
          <Pressable
            style={[styles.backButton, { borderColor: colors.border }]}
            onPress={handleGoBack}
            accessibilityLabel="Go back to previous screen"
            accessibilityRole="button"
          >
            <Text style={[styles.backButtonText, { color: colors.text }]}>
              Go Back
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const validType: ValidType = selectedType ?? routeType;
  const title = TYPE_TITLES[validType];

  const handleSuccess = (data: SuccessData) => {
    setSuccessData(data);
  };

  const handleUtilityTypeChange = (nextType: ValidType) => {
    if (nextType === validType) {
      return;
    }

    setSelectedType(nextType);
  };

  const lastTransaction = recentTransactions?.[0] ?? null;
  const isLastTransactionForCurrentType = lastTransaction
    ? utilityRepeatHelpers.getRouteType(lastTransaction.type) === validType
    : false;
  const showQuickRepeat =
    lastTransaction &&
    isLastTransactionForCurrentType &&
    lastTransaction.status === 'successful' &&
    !isRecentTransactionsLoading &&
    !recentTransactionsError &&
    !isKeyboardVisible &&
    !isQuickRepeatDismissed;
  let quickRepeatNotice: string | null = null;
  if (!isKeyboardVisible && !isQuickRepeatDismissed) {
    if (isRecentTransactionsLoading) {
      quickRepeatNotice = `Checking recent ${title} transactions...`;
    } else if (recentTransactionsError) {
      quickRepeatNotice = `Recent ${title} transactions unavailable.`;
    }
  }
  const handleQuickRepeat = () => {
    if (
      !lastTransaction ||
      !isLastTransactionForCurrentType ||
      lastTransaction.status !== 'successful'
    ) {
      return;
    }

    setRepeatDefaults(utilityRepeatHelpers.getDefaults(lastTransaction));
    setRepeatRevision((current) => current + 1);
    setIsQuickRepeatDismissed(true);
  };

  const isRepeatPaymentReady = Boolean(repeatDefaults.isVerified);

  const paramSuccessData =
    (params.paymentStatus === 'successful' ||
      params.paymentStatus === 'processing') &&
    params.reference
      ? {
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
        }
      : null;
  const resolvedSuccessData = successData ?? paramSuccessData;

  if (resolvedSuccessData) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View
          style={[
            styles.successShell,
            {
              paddingTop: headerOffset,
              paddingBottom: Math.max(insets.bottom - 12, 0),
            },
          ]}
        >
          <PurchaseSuccess
            type={validType}
            amount={resolvedSuccessData.amount}
            customerIdentifier={resolvedSuccessData.customerIdentifier}
            txReference={resolvedSuccessData.reference}
            cashback={resolvedSuccessData.cashback ?? null}
            isAuthenticated={isAuthenticated}
            onCreateAccount={() => router.push('/auth/login')}
            status={resolvedSuccessData.status}
            voucherPin={resolvedSuccessData.voucherPin}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <UtilityHeader
        title={title}
        onBack={handleGoBack}
        onHistory={() =>
          router.push(`/utilities/history?type=${validType}` as Href)
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
          selectedType={validType}
          onSelect={handleUtilityTypeChange}
        />
        {validType === 'airtime' && (
          <AirtimeForm
            key={`airtime-${repeatRevision}`}
            initialAmount={repeatDefaults.amount}
            initialPhoneNumber={repeatDefaults.phoneNumber}
            initialProvider={repeatDefaults.networkProvider}
            isRepeatPaymentReady={isRepeatPaymentReady}
            onSuccess={handleSuccess}
          />
        )}
        {validType === 'data' && (
          <DataForm
            key={`data-${repeatRevision}`}
            initialAmount={repeatDefaults.amount}
            initialPhoneNumber={repeatDefaults.phoneNumber}
            initialPlan={repeatDefaults.dataPlanCode}
            initialProvider={repeatDefaults.networkProvider}
            isRepeatPaymentReady={isRepeatPaymentReady}
            onSuccess={handleSuccess}
          />
        )}
        {(validType === 'tv' ||
          validType === 'power' ||
          validType === 'gaming') && (
          <BillForm
            key={`${validType}-${repeatRevision}`}
            initialAmount={repeatDefaults.amount}
            initialBillerName={repeatDefaults.billerName}
            initialBillItemIdentifier={repeatDefaults.billItemIdentifier}
            initialCustomerIdentifier={repeatDefaults.customerIdentifier}
            isRepeatPaymentReady={isRepeatPaymentReady}
            type={validType as 'tv' | 'power' | 'gaming'}
            onSuccess={handleSuccess}
          />
        )}
      </KeyboardAvoidingView>
      {quickRepeatNotice ? (
        <View
          accessible={true}
          accessibilityRole="alert"
          accessibilityLabel={quickRepeatNotice}
          style={[
            styles.quickRepeatNotice,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              bottom: Math.max(insets.bottom, 12) + 92,
            },
          ]}
        >
          <Ionicons
            name={
              isRecentTransactionsLoading
                ? 'time-outline'
                : 'alert-circle-outline'
            }
            size={18}
            color={colors.textSecondary}
          />
          <Text
            style={[
              styles.quickRepeatNoticeText,
              { color: colors.textSecondary },
            ]}
          >
            {quickRepeatNotice}
          </Text>
        </View>
      ) : null}
      {showQuickRepeat && lastTransaction ? (
        <Pressable
          style={[
            styles.quickRepeatButton,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              bottom: Math.max(insets.bottom, 12) + 92,
            },
          ]}
          onPress={handleQuickRepeat}
          accessibilityRole="button"
          accessibilityLabel={`Repeat last ${title} transaction`}
        >
          <Ionicons name="refresh" size={18} color={colors.tint} />
          <View style={styles.quickRepeatCopy}>
            <Text style={[styles.quickRepeatLabel, { color: colors.text }]}>
              Repeat last {title}
            </Text>
            <Text
              style={[
                styles.quickRepeatDetail,
                { color: colors.textSecondary },
              ]}
              numberOfLines={1}
            >
              ₦{lastTransaction.amount.toLocaleString()}
            </Text>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  successShell: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerSide: {
    width: 68,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerSideRight: {
    justifyContent: 'flex-end',
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerIconButton: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconCircle: {
    alignItems: 'center',
    borderRadius: 26,
    elevation: 5,
    height: 52,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    width: 52,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  errorMessage: { fontSize: 15, textAlign: 'center', marginBottom: 24 },
  backButton: {
    minHeight: 34,
    paddingHorizontal: 9,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  backButtonText: { fontSize: 14, fontWeight: '600' },
  quickRepeatButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    elevation: 4,
    flexDirection: 'row',
    gap: 10,
    left: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    position: 'absolute',
    right: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
  },
  quickRepeatNotice: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    left: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    position: 'absolute',
    right: 16,
  },
  quickRepeatCopy: {
    flex: 1,
  },
  quickRepeatDetail: {
    fontSize: 12,
    marginTop: 2,
  },
  quickRepeatLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  quickRepeatNoticeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
});
