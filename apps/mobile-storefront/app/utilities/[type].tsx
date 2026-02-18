import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

export default function UtilityPurchaseScreen() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isAuthenticated = useAuthStore((state) => !!state.session);

  const [successData, setSuccessData] = useState<SuccessData | null>(null);

  // Bug #59: Validate the type param instead of silently defaulting to 'airtime'
  if (!type || !isValidType(type)) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <Stack.Screen
          options={{ title: 'Invalid Service', headerBackTitle: '' }}
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
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace('/')
            }
            accessibilityLabel="Go back to previous screen"
            accessibilityRole="button"
          >
            <Text style={[styles.backButtonText, { color: colors.text }]}>
              Go Back
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const validType = type;
  const title = TYPE_TITLES[validType];

  const handleSuccess = (data: SuccessData) => {
    setSuccessData(data);
  };

  if (successData) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <PurchaseSuccess
          type={validType}
          customerIdentifier={successData.customerIdentifier}
          txReference={successData.reference}
          cashback={successData.cashback ?? null}
          isAuthenticated={isAuthenticated}
          onCreateAccount={() => router.push('/auth/login')}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['bottom']}
    >
      <Stack.Screen options={{ title, headerBackTitle: '' }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  errorMessage: { fontSize: 15, textAlign: 'center', marginBottom: 24 },
  backButton: {
    height: 48,
    paddingHorizontal: 32,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: { fontSize: 16, fontWeight: '600' },
});
