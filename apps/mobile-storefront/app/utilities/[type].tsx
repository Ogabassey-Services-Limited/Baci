import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
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

const TYPE_TITLES: Record<string, string> = {
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

  const validType = type || 'airtime';
  const title = TYPE_TITLES[validType] || 'Utility';

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
});
