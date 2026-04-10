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

const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

/** Height reserved for the absolutely-positioned payment footer */
const FOOTER_HEIGHT = 120;
const FOOTER_ERROR_BUFFER = 36;

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
  const { isKeyboardVisible, keyboardHeight } = useKeyboard();
  const customer = useAuthStore((state) => state.customer);
  const payment = useUtilityPayment();

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
  const footerSpacerHeight =
    FOOTER_HEIGHT + Math.max(insets.bottom - 26, 0) + FOOTER_ERROR_BUFFER;
  const footerBottomOffset = getUtilityFooterOffset({
    bottomInset: insets.bottom,
    isKeyboardVisible,
    keyboardHeight,
  });

  // Bug #61: Guard against double-tap with isSubmitting state
  const isBusy = isSubmitting;

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
          amount: numericAmount,
          customerName,
          customerPhone: customer?.phone,
          networkProvider: selectedProvider,
          phoneNumber,
          savedPaymentMethodId: payment.selectedSavedCardId,
          type: 'airtime',
        });

        if (requiresSavedVtuCardAuthorization(result)) {
          router.push({
            pathname: '/payment-gateway',
            params: {
              amount: String(numericAmount),
              authorizationUrl: result.authorization_url,
              customerIdentifier: phoneNumber,
              gateway: result.gateway,
              paymentKind: 'vtu',
              reference: result.reference,
              utilityType: 'airtime',
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
            amount: confirmed.amount ?? numericAmount,
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
        type: 'airtime',
        amount: numericAmount,
        customerName,
        customerPhone: customer?.phone,
        gateway: payment.selectedGateway,
        networkProvider: selectedProvider,
        phoneNumber,
      });
      router.push({
        pathname: '/payment-gateway',
        params: {
          amount: String(numericAmount),
          authorizationUrl: result.authorization_url,
          customerIdentifier: phoneNumber,
          gateway: result.gateway,
          paymentKind: 'vtu',
          reference: result.reference,
          utilityType: 'airtime',
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

        <UtilityPaymentOptions
          amount={numericAmount}
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
            marginBottom: isKeyboardVisible
              ? 0
              : -Math.max(insets.bottom - 4, 0),
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
                ? `Pay ₦${numericAmount ? numericAmount.toLocaleString() : '0'}`
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
});
