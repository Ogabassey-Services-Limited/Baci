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
import { useVTUBillers } from '@/hooks/use-vtu-billers';
import { useVTUPurchase } from '@/hooks/use-vtu-purchase';
import { detectNetwork } from '@/lib/network-utils';
import { ProviderGrid } from './ProviderGrid';

/** Height reserved for the absolutely-positioned payment footer */
const FOOTER_HEIGHT = 120;

interface DataFormProps {
  onSuccess: (data: {
    reference: string;
    amount: number;
    cashback?: { amount: number; newBalance: number };
  }) => void;
}

export function DataForm({ onSuccess }: DataFormProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const purchase = useVTUPurchase();
  const { data: dataPlans, isLoading: plansLoading } = useVTUBillers('data');

  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [planAmount, setPlanAmount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Bug #H18: Guard against double-tap with isSubmitting state (same pattern as AirtimeForm)
  const isBusy = isSubmitting || purchase.isPending;

  const handlePhoneChange = (text: string) => {
    const digits = text.replace(/\D/g, '');
    setPhoneNumber(digits);
    const detected = detectNetwork(digits);
    if (detected) setSelectedProvider(detected);
  };

  const handlePurchase = async () => {
    // Bug #H18: Prevent double-tap duplicate purchases
    if (isBusy) return;

    if (!selectedProvider || !phoneNumber || !selectedPlan) {
      Alert.alert(
        'Missing Information',
        'Please select a provider, enter phone number, and choose a plan.'
      );
      return;
    }
    // Bug #64: Prevent submission when planAmount is 0 or not set
    if (planAmount <= 0) {
      Alert.alert(
        'Invalid Amount',
        'Please enter a valid amount before proceeding.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await purchase.mutateAsync({
        type: 'data',
        phoneNumber,
        amount: planAmount,
        networkProvider: selectedProvider,
        dataPlanCode: selectedPlan,
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

        <Text
          style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}
        >
          Select Plan
        </Text>
        {plansLoading ? (
          <ActivityIndicator
            color={BRAND.primary}
            style={{ marginVertical: 16 }}
          />
        ) : dataPlans && dataPlans.length > 0 ? (
          <View style={styles.planGrid}>
            {dataPlans.map((plan) => {
              const isSelected = selectedPlan === plan.billerId;
              return (
                <Pressable
                  key={plan.billerId}
                  style={[
                    styles.planCard,
                    {
                      backgroundColor: isSelected ? BRAND.primary : colors.card,
                      borderColor: isSelected ? BRAND.primary : colors.border,
                    },
                  ]}
                  onPress={() => {
                    setSelectedPlan(plan.billerId);
                    // Bug #H19: Don't reset amount to 0 on plan select.
                    // Biller data has no price field, so keep the user's existing amount.
                  }}
                >
                  <Text
                    style={[
                      styles.planName,
                      { color: isSelected ? '#FFF' : colors.text },
                    ]}
                    numberOfLines={2}
                  >
                    {plan.billerName}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Select a provider to see available data plans
          </Text>
        )}

        {/* Manual amount fallback */}
        <View style={[styles.inputGroup, { marginTop: 16 }]}>
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
            placeholder="Enter amount"
            placeholderTextColor={colors.placeholder}
            keyboardType="number-pad"
            value={planAmount > 0 ? String(planAmount) : ''}
            onChangeText={(t) => setPlanAmount(Number(t.replace(/\D/g, '')))}
          />
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
              Pay ₦{planAmount ? planAmount.toLocaleString() : '0'}
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
  input: {
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, marginBottom: 8 },
  planGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  planCard: { width: '48%', padding: 14, borderRadius: 12, borderWidth: 1 },
  planName: { fontSize: 13, fontWeight: '500' },
  emptyText: { fontSize: 14, textAlign: 'center', marginVertical: 16 },
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
