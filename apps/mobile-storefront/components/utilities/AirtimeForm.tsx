import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, SPACING } from '@/constants/Colors';
import { useVTUPurchase } from '@/hooks/use-vtu-purchase';
import { detectNetwork } from '@/lib/network-utils';
import { ProviderGrid } from './ProviderGrid';

const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

/** Height reserved for the absolutely-positioned payment footer */
const FOOTER_HEIGHT = 120;

interface AirtimeFormProps {
  onSuccess: (data: {
    reference: string;
    amount: number;
    cashback?: { amount: number; newBalance: number };
  }) => void;
}

export function AirtimeForm({ onSuccess }: AirtimeFormProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const purchase = useVTUPurchase();

  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePhoneChange = (text: string) => {
    const digits = text.replace(/\D/g, '');
    setPhoneNumber(digits);
    const detected = detectNetwork(digits);
    if (detected) setSelectedProvider(detected);
  };

  const numericAmount = Number(amount.replace(/\D/g, ''));

  // Bug #61: Guard against double-tap with isSubmitting state
  const isBusy = isSubmitting || purchase.isPending;

  const handlePurchase = async () => {
    if (isBusy) return;
    if (!selectedProvider || !phoneNumber || !amount) {
      Alert.alert('Missing Information', 'Please fill in all fields.');
      return;
    }
    if (numericAmount < 50 || numericAmount > 50000) {
      Alert.alert('Invalid Amount', 'Amount must be between ₦50 and ₦50,000.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await purchase.mutateAsync({
        type: 'airtime',
        phoneNumber,
        amount: numericAmount,
        networkProvider: selectedProvider,
      });
      onSuccess({
        reference: result.reference,
        amount: result.amount,
        cashback: result.cashback
          ? {
              amount: result.cashback.amount,
              newBalance: result.cashback.newBalance,
            }
          : undefined,
      });
    } catch (error) {
      Alert.alert(
        'Purchase Failed',
        error instanceof Error ? error.message : 'Something went wrong.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, styles.contentWithFooter]}
      >
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Select Provider
        </Text>
        <ProviderGrid
          selectedProvider={selectedProvider}
          onSelect={setSelectedProvider}
        />

        <Text
          style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}
        >
          Details
        </Text>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Phone Number
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.muted,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            placeholder="08012345678"
            placeholderTextColor={colors.placeholder}
            keyboardType="phone-pad"
            value={phoneNumber}
            onChangeText={handlePhoneChange}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Amount (₦)
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.muted,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            placeholder="1,000"
            placeholderTextColor={colors.placeholder}
            keyboardType="number-pad"
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/\D/g, ''))}
          />
          <View style={styles.quickAmounts}>
            {QUICK_AMOUNTS.map((amt) => (
              <Pressable
                key={amt}
                style={[styles.quickChip, { borderColor: colors.border }]}
                onPress={() => setAmount(String(amt))}
              >
                <Text style={[styles.quickChipText, { color: colors.text }]}>
                  ₦{amt.toLocaleString()}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            borderTopColor: colors.border,
            backgroundColor: colors.muted,
            marginBottom: -Math.max(insets.bottom - 4, 0),
            paddingBottom: Math.max(insets.bottom - 26, 0),
          },
        ]}
      >
        {purchase.error && (
          <Text style={styles.errorText}>
            {purchase.error instanceof Error
              ? purchase.error.message
              : 'Purchase failed'}
          </Text>
        )}
        <Pressable
          style={[
            styles.payButton,
            {
              backgroundColor: BRAND.primary,
              opacity: isBusy ? 0.7 : 1,
            },
          ]}
          onPress={handlePurchase}
          disabled={isBusy}
        >
          {isBusy ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.payButtonText}>
              Pay ₦{numericAmount ? numericAmount.toLocaleString() : '0'}
            </Text>
          )}
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  content: { padding: SPACING.md },
  contentWithFooter: {
    paddingBottom: FOOTER_HEIGHT,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, marginBottom: 8 },
  input: {
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  quickAmounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  quickChipText: { fontSize: 13, fontWeight: '500' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    borderTopWidth: 1,
  },
  payButton: {
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
    textAlign: 'center' as const,
    marginBottom: 12,
  },
});
