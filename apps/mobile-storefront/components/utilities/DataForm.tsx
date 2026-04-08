import { router } from 'expo-router';
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
import { useKeyboard } from '@/hooks/use-keyboard';
import { useUtilityPayment } from '@/hooks/use-utility-payment';
import { useVTUBillers } from '@/hooks/use-vtu-billers';
import { detectNetwork } from '@/lib/network-utils';
import {
  chargeSavedVtuCard,
  initializeVtuCheckout,
  isSavedVtuCardChargeProcessing,
  requiresSavedVtuCardAuthorization,
  waitForVtuConfirmation,
} from '@/lib/vtu-checkout';
import { useAuthStore } from '@/stores/auth-store';
import { getUtilityFooterOffset } from './get-utility-footer-offset';
import { ProviderGrid } from './ProviderGrid';
import { UtilityPaymentOptions } from './UtilityPaymentOptions';

/** Height reserved for the absolutely-positioned payment footer */
const FOOTER_HEIGHT = 120;
const FOOTER_ERROR_BUFFER = 36;

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
  const { isKeyboardVisible, keyboardHeight } = useKeyboard();
  const customer = useAuthStore((state) => state.customer);
  const payment = useUtilityPayment();
  const { data: dataPlans, isLoading: plansLoading } = useVTUBillers('data');

  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [planAmount, setPlanAmount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const footerSpacerHeight =
    FOOTER_HEIGHT +
    Math.max(insets.bottom - 26, 0) +
    FOOTER_ERROR_BUFFER;
  const footerBottomOffset = getUtilityFooterOffset({
    bottomInset: insets.bottom,
    isKeyboardVisible,
    keyboardHeight,
  });

  // Bug #H18: Guard against double-tap with isSubmitting state (same pattern as AirtimeForm)
  const isBusy = isSubmitting;

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
    if (!payment.selectedSavedCardId && !payment.selectedGateway) {
      Alert.alert(
        'Select Payment Method',
        'Choose a payment method before continuing.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const customerName =
        [customer?.first_name, customer?.last_name].filter(Boolean).join(' ') ||
        customer?.email;

      if (payment.selectedSavedCardId) {
        const result = await chargeSavedVtuCard({
          amount: planAmount,
          customerName,
          customerPhone: customer?.phone,
          dataPlanCode: selectedPlan,
          networkProvider: selectedProvider,
          phoneNumber,
          savedPaymentMethodId: payment.selectedSavedCardId,
          type: 'data',
        });

        if (requiresSavedVtuCardAuthorization(result)) {
          router.push({
            pathname: '/payment-gateway',
            params: {
              amount: String(planAmount),
              authorizationUrl: result.authorization_url,
              customerIdentifier: phoneNumber,
              gateway: result.gateway,
              paymentKind: 'vtu',
              reference: result.reference,
              utilityType: 'data',
            },
          });
          return;
        }

        if (isSavedVtuCardChargeProcessing(result)) {
          const confirmed = await waitForVtuConfirmation({
            gateway: 'paystack',
            reference: result.reference,
          });
          onSuccess({
            amount: confirmed.amount ?? planAmount,
            cashback: confirmed.cashback
              ? {
                  amount: confirmed.cashback.amount,
                  newBalance: confirmed.cashback.newBalance,
                }
              : undefined,
            reference: confirmed.reference,
          });
          return;
        }

        onSuccess({
          amount: result.amount,
          cashback: result.cashback
            ? {
                amount: result.cashback.amount,
                newBalance: result.cashback.newBalance,
              }
            : undefined,
          reference: result.reference,
        });
        return;
      }

      const result = await initializeVtuCheckout({
        amount: planAmount,
        customerName,
        customerPhone: customer?.phone,
        dataPlanCode: selectedPlan,
        gateway: payment.selectedGateway,
        networkProvider: selectedProvider,
        phoneNumber,
        type: 'data',
      });
      router.push({
        pathname: '/payment-gateway',
        params: {
          amount: String(planAmount),
          authorizationUrl: result.authorization_url,
          customerIdentifier: phoneNumber,
          gateway: result.gateway,
          paymentKind: 'vtu',
          reference: result.reference,
          utilityType: 'data',
        },
      });
    } catch (error) {
      Alert.alert(
        'Payment Failed',
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
        contentContainerStyle={[
          styles.content,
          { paddingBottom: footerSpacerHeight },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
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

        <UtilityPaymentOptions
          amount={planAmount}
          cards={payment.cards}
          isLoadingCards={payment.isLoadingCards}
          onSelectGateway={payment.selectGateway}
          onSelectSavedCard={payment.selectSavedCard}
          selectedGateway={payment.selectedGateway}
          selectedSavedCardId={payment.selectedSavedCardId}
          supportedGateways={payment.supportedGateways}
        />
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            borderTopColor: colors.border,
            backgroundColor: colors.muted,
            bottom: footerBottomOffset,
            marginBottom: isKeyboardVisible ? 0 : -Math.max(insets.bottom - 4, 0),
            paddingBottom: isKeyboardVisible
              ? SPACING.sm
              : Math.max(insets.bottom - 26, 0),
          },
        ]}
      >
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
              {payment.selectedSavedCardId
                ? `Pay ₦${planAmount ? planAmount.toLocaleString() : '0'}`
                : 'Continue to Payment'}
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
});
