import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, SPACING } from '@/constants/Colors';

interface CashbackInfo {
  amount: number;
  newBalance: number;
}

interface PurchaseSuccessProps {
  type: string;
  phoneNumber?: string;
  customerIdentifier?: string;
  txReference: string | null;
  cashback: CashbackInfo | null;
  isAuthenticated: boolean;
  onCreateAccount: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  airtime: 'airtime',
  data: 'data',
  tv: 'TV subscription',
  power: 'electricity',
  gaming: 'betting',
};

export function PurchaseSuccess({
  type,
  phoneNumber,
  customerIdentifier,
  txReference,
  cashback,
  isAuthenticated,
  onCreateAccount,
}: PurchaseSuccessProps) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const identifier = phoneNumber || customerIdentifier || '';

  return (
    <Animated.View entering={FadeIn} style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name="checkmark-circle" size={80} color={BRAND.primary} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>
        Purchase Successful!
      </Text>
      <Text style={[styles.message, { color: colors.textSecondary }]}>
        Your {TYPE_LABELS[type] || type} purchase for {identifier} was
        successful.
      </Text>

      {txReference && (
        <Text style={[styles.referenceText, { color: colors.textSecondary }]}>
          Ref: {txReference}
        </Text>
      )}

      {cashback && (
        <View style={styles.cashbackCard}>
          <Ionicons
            name="wallet-outline"
            size={20}
            color="#059669"
            style={{ marginBottom: 4 }}
          />
          <Text style={styles.cashbackAmount}>
            +₦{cashback.amount.toLocaleString()} cashback
          </Text>
          <Text style={styles.cashbackBalance}>
            Wallet balance: ₦{cashback.newBalance.toLocaleString()}
          </Text>
        </View>
      )}

      {!isAuthenticated && (
        <View
          style={[
            styles.upsellCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.upsellTitle, { color: colors.text }]}>
            Save this beneficiary?
          </Text>
          <Text style={[styles.upsellText, { color: colors.textSecondary }]}>
            Create an account to save this number, view transaction history, and
            earn loyalty points!
          </Text>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: BRAND.primary }]}
            onPress={onCreateAccount}
          >
            <Text style={styles.primaryButtonText}>Create Account</Text>
          </Pressable>
        </View>
      )}

      <Pressable
        style={[styles.secondaryButton, { borderColor: colors.border }]}
        onPress={() => router.push('/')}
      >
        <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
          Back to Home
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  iconContainer: { marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  message: { fontSize: 16, textAlign: 'center', marginBottom: 32 },
  referenceText: {
    fontSize: 13,
    textAlign: 'center' as const,
    marginBottom: 24,
  },
  cashbackCard: {
    width: '100%' as unknown as number,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center' as const,
    marginBottom: 24,
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  cashbackAmount: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#059669',
  },
  cashbackBalance: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  upsellCard: {
    width: '100%' as unknown as number,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  upsellTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  upsellText: { fontSize: 14, marginBottom: 16 },
  primaryButton: {
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  secondaryButton: {
    width: '100%' as unknown as number,
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  secondaryButtonText: { fontSize: 16, fontWeight: '600' },
});
