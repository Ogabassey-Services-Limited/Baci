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
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, SPACING } from '@/constants/Colors';
import type { Biller } from '@/hooks/use-vtu-billers';
import { useVTUBillers } from '@/hooks/use-vtu-billers';
import { useVTUPurchase } from '@/hooks/use-vtu-purchase';
import { useVTUVerify } from '@/hooks/use-vtu-verify';
import { BillerList } from './BillerList';
import { VerificationCard } from './VerificationCard';

/** Maps mobile route types to API bill types */
const BILL_TYPE_MAP: Record<string, string> = {
  tv: 'cable_tv',
  power: 'electricity',
  gaming: 'betting',
};

const IDENTIFIER_LABELS: Record<string, string> = {
  tv: 'Smart Card Number',
  power: 'Meter Number',
  gaming: 'Account ID',
};

const IDENTIFIER_PLACEHOLDERS: Record<string, string> = {
  tv: 'Enter smart card number',
  power: 'Enter meter number',
  gaming: 'Enter account ID',
};

interface BillFormProps {
  type: 'tv' | 'power' | 'gaming';
  onSuccess: (data: {
    reference: string;
    amount: number;
    customerIdentifier?: string;
    cashback?: { amount: number; newBalance: number };
  }) => void;
}

export function BillForm({ type, onSuccess }: BillFormProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const billType = BILL_TYPE_MAP[type];
  const {
    data: billers,
    isLoading: billersLoading,
    isError: billersError,
    error: billersErrorObj,
  } = useVTUBillers(billType);
  const verify = useVTUVerify();
  const purchase = useVTUPurchase();

  const [selectedBiller, setSelectedBiller] = useState<Biller | null>(null);
  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const numericAmount = Number(amount.replace(/\D/g, ''));

  // Bug #M24: Guard against double-tap with isSubmitting state (same pattern as AirtimeForm)
  const isBusy = isSubmitting || purchase.isPending;

  const handleVerify = () => {
    if (!selectedBiller || !customerId) {
      Alert.alert(
        'Missing Information',
        `Please select a provider and enter your ${IDENTIFIER_LABELS[type].toLowerCase()}.`
      );
      return;
    }
    verify.mutate({
      billItemIdentifier: selectedBiller.billerId,
      customerIdentifier: customerId,
    });
  };

  const handlePurchase = async () => {
    // Bug #M24: Prevent double-tap duplicate payments
    if (isBusy) return;

    // Bug #71: Explicitly check verification is complete before allowing purchase
    if (!selectedBiller) {
      Alert.alert('Missing Provider', 'Please select a provider.');
      return;
    }
    if (!verify.data?.verified) {
      Alert.alert(
        'Verification Required',
        `Please verify your ${IDENTIFIER_LABELS[type].toLowerCase()} before making a purchase.`
      );
      return;
    }
    if (!amount) {
      Alert.alert('Missing Amount', 'Please enter an amount.');
      return;
    }
    if (numericAmount < 50 || numericAmount > 500000) {
      Alert.alert('Invalid Amount', 'Amount must be between ₦50 and ₦500,000.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await purchase.mutateAsync({
        type: billType as 'electricity' | 'cable_tv' | 'betting',
        amount: numericAmount,
        billItemIdentifier: selectedBiller.billerId,
        customerIdentifier: customerId,
        billerName: selectedBiller.billerName,
      });
      onSuccess({
        reference: result.reference,
        amount: result.amount,
        customerIdentifier: customerId,
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
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Select Provider
        </Text>
        <BillerList
          billers={billers || []}
          selectedBillerId={selectedBiller?.billerId ?? null}
          onSelect={(biller) => {
            setSelectedBiller(biller);
            // Bug #72: Only reset verification when not in a pending state
            if (!verify.isPending) {
              verify.reset();
            }
          }}
          isLoading={billersLoading}
          errorMessage={
            billersError
              ? billersErrorObj instanceof Error
                ? billersErrorObj.message
                : 'Failed to load providers. Please try again.'
              : undefined
          }
        />

        {selectedBiller && (
          <>
            <Text
              style={[
                styles.sectionTitle,
                { color: colors.text, marginTop: 24 },
              ]}
            >
              {IDENTIFIER_LABELS[type]}
            </Text>
            <View style={styles.verifyRow}>
              <TextInput
                style={[
                  styles.input,
                  styles.verifyInput,
                  {
                    backgroundColor: colors.muted,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                placeholder={IDENTIFIER_PLACEHOLDERS[type]}
                placeholderTextColor={colors.placeholder}
                keyboardType="number-pad"
                value={customerId}
                onChangeText={(text) => {
                  setCustomerId(text);
                  // Bug #72: Only reset verification when not in a pending state
                  if (!verify.isPending) {
                    verify.reset();
                  }
                }}
              />
              <Pressable
                style={[
                  styles.verifyButton,
                  { opacity: !customerId || verify.isPending ? 0.6 : 1 },
                ]}
                onPress={handleVerify}
                disabled={!customerId || verify.isPending}
              >
                {verify.isPending ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.verifyButtonText}>Verify</Text>
                )}
              </Pressable>
            </View>

            {(verify.data || verify.isPending) && (
              <View style={{ marginTop: 12 }}>
                <VerificationCard
                  verified={verify.data?.verified ?? false}
                  customerName={verify.data?.customerName}
                  message={verify.data?.message}
                  isLoading={verify.isPending}
                />
              </View>
            )}
          </>
        )}

        {verify.data?.verified && (
          <View style={{ marginTop: 24 }}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
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
              placeholder="Enter amount"
              placeholderTextColor={colors.placeholder}
              keyboardType="number-pad"
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/\D/g, ''))}
            />
          </View>
        )}
      </ScrollView>

      {verify.data?.verified && (
        <View
          style={[
            styles.footer,
            {
              borderTopColor: colors.border,
              backgroundColor: colors.background,
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
      )}
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACING.md },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  input: {
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  verifyRow: { flexDirection: 'row', gap: 10 },
  verifyInput: { flex: 1 },
  verifyButton: {
    backgroundColor: '#1F2937',
    height: 50,
    paddingHorizontal: 20,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyButtonText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  footer: { padding: SPACING.md, borderTopWidth: 1 },
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
