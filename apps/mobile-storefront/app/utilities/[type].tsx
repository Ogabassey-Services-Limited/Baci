import { Ionicons } from '@expo/vector-icons';
import { type Href, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
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
import Colors from '@/constants/Colors';
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
}

const VALID_TYPES = ['airtime', 'data', 'tv', 'power', 'gaming'] as const;
type ValidType = (typeof VALID_TYPES)[number];

function isValidType(value: string): value is ValidType {
  return (VALID_TYPES as readonly string[]).includes(value);
}

const TYPE_TITLES: Record<ValidType, string> = {
  airtime: 'Buy Airtime',
  data: 'Buy Data',
  tv: 'TV Subscription',
  power: 'Pay Electricity',
  gaming: 'Betting Top-up',
};

function UtilityHeader({
  title,
  onBack,
  onHistory,
  color,
  borderColor,
  topInset,
  surfaceColor,
}: {
  title: string;
  onBack: () => void;
  onHistory?: () => void;
  color: string;
  borderColor: string;
  topInset: number;
  surfaceColor: string;
}) {
  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: surfaceColor,
          borderBottomColor: borderColor,
          marginTop: -Math.max(topInset - 8, 0),
          paddingTop: Math.max(topInset - 42, 0),
        },
      ]}
    >
      <View style={styles.headerSide}>
        <Pressable
          style={[styles.backButton, { borderColor }]}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={18} color={color} />
          <Text style={[styles.backButtonText, { color }]}>Back</Text>
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
            style={[styles.headerActionButton, { borderColor }]}
            onPress={onHistory}
            accessibilityRole="button"
            accessibilityLabel="View utility history"
          >
            <Text style={[styles.headerActionText, { color }]}>History</Text>
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
  }>();
  const { type } = params;
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const headerOffset = Math.max(insets.top, 42);
  const isAuthenticated = useAuthStore((state) => !!state.session);

  const [successData, setSuccessData] = useState<SuccessData | null>(null);

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/');
  };

  // Bug #59: Validate the type param instead of silently defaulting to 'airtime'
  if (!type || !isValidType(type)) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <UtilityHeader
          title="Invalid Service"
          onBack={handleGoBack}
          color={colors.text}
          borderColor={colors.border}
          topInset={insets.top}
          surfaceColor={colors.muted}
        />
        <View style={[styles.errorContainer, { paddingTop: headerOffset }]}>
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

  const validType = type;
  const title = TYPE_TITLES[validType];

  const handleSuccess = (data: SuccessData) => {
    setSuccessData(data);
  };

  const paramSuccessData =
    params.paymentStatus === 'successful' && params.reference
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
            customerIdentifier={resolvedSuccessData.customerIdentifier}
            txReference={resolvedSuccessData.reference}
            cashback={resolvedSuccessData.cashback ?? null}
            isAuthenticated={isAuthenticated}
            onCreateAccount={() => router.push('/auth/login')}
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
        borderColor={colors.border}
        topInset={insets.top}
        surfaceColor={colors.muted}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={headerOffset}
        style={[styles.flex, { paddingTop: headerOffset }]}
      >
        {validType === 'airtime' && <AirtimeForm onSuccess={handleSuccess} />}
        {validType === 'data' && <DataForm onSuccess={handleSuccess} />}
        {(validType === 'tv' ||
          validType === 'power' ||
          validType === 'gaming') && (
          <BillForm
            type={validType as 'tv' | 'power' | 'gaming'}
            onSuccess={handleSuccess}
          />
        )}
      </KeyboardAvoidingView>
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    minHeight: 42,
    paddingHorizontal: 16,
    paddingBottom: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerSide: {
    minWidth: 72,
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
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerActionButton: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionText: {
    fontSize: 13,
    fontWeight: '600',
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
});
