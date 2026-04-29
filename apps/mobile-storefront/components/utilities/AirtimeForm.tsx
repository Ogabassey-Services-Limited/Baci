import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { NETWORK_PROVIDERS } from '@/constants/network-providers';
import { useKeyboard } from '@/hooks/use-keyboard';
import { useUtilityPayment } from '@/hooks/use-utility-payment';
import { detectNetwork } from '@/lib/network-utils';
import {
  chargeSavedVtuCard,
  initializeVtuCheckout,
  isSavedVtuCardChargeProcessing,
  requiresSavedVtuCardAuthorization,
  VtuPaymentStillProcessingError,
  waitForVtuConfirmation,
} from '@/lib/vtu-checkout';
import { useAuthStore } from '@/stores/auth-store';
import { getUtilityFooterOffset } from './get-utility-footer-offset';
import { ProviderGrid } from './ProviderGrid';
import { UtilityPaymentOptions } from './UtilityPaymentOptions';
import { formatUtilityAmountInput } from './utility-amount-format';

const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];
const NETWORK_PROVIDER_LABELS: Record<string, string> = {
  airtel: 'Airtel',
  glo: 'Glo',
  mtn: 'MTN',
  t2: 'T2 (9mobile)',
};

/** Height reserved for the absolutely-positioned payment footer */
const FOOTER_HEIGHT = 120;
const FOOTER_ERROR_BUFFER = 36;

interface AirtimeFormProps {
  onSuccess: (data: {
    reference: string;
    amount: number;
    customerIdentifier?: string;
    status?: 'processing' | 'successful';
    voucherPin?: string;
    cashback?: { amount: number; newBalance: number };
  }) => void;
  initialAmount?: string;
  initialPhoneNumber?: string;
  initialProvider?: string;
  isRepeatPaymentReady?: boolean;
}

export function AirtimeForm({
  initialAmount,
  initialPhoneNumber,
  initialProvider,
  isRepeatPaymentReady = false,
  onSuccess,
}: AirtimeFormProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const { dismissKeyboard, isKeyboardVisible, keyboardHeight } = useKeyboard();
  const customer = useAuthStore((state) => state.customer);
  const payment = useUtilityPayment();
  const scrollViewRef = useRef<ScrollView>(null);

  const [selectedProvider, setSelectedProvider] = useState<string | null>(
    initialProvider ??
      (initialPhoneNumber ? detectNetwork(initialPhoneNumber) : null)
  );
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber ?? '');
  const [amount, setAmount] = useState(initialAmount ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNetworkPickerExpanded, setIsNetworkPickerExpanded] = useState(false);
  const [shouldScrollToPayment, setShouldScrollToPayment] =
    useState(isRepeatPaymentReady);

  const handlePhoneChange = (text: string) => {
    const digits = text.replace(/\D/g, '');
    setPhoneNumber(digits);
    const detected = detectNetwork(digits);
    if (detected) {
      setSelectedProvider(detected);
      setIsNetworkPickerExpanded(false);
      return;
    }

    if (digits.length >= 4) {
      setIsNetworkPickerExpanded(true);
    }
  };

  const handleProviderSelect = (provider: string) => {
    setSelectedProvider(provider);
    setIsNetworkPickerExpanded(false);
  };

  const numericAmount = Number(amount.replace(/\D/g, ''));
  const formattedAmount = formatUtilityAmountInput(amount);
  const selectedProviderConfig =
    NETWORK_PROVIDERS.find((provider) => provider.id === selectedProvider) ??
    null;
  const footerSpacerHeight =
    FOOTER_HEIGHT + Math.max(insets.bottom, SPACING.md) + FOOTER_ERROR_BUFFER;
  const footerBottomOffset = getUtilityFooterOffset({
    bottomInset: insets.bottom,
    isKeyboardVisible,
    keyboardHeight,
  });

  // Bug #61: Guard against double-tap with isSubmitting state
  const isBusy = isSubmitting;

  useEffect(() => {
    if (isRepeatPaymentReady) {
      setShouldScrollToPayment(true);
    }
  }, [isRepeatPaymentReady]);

  const handlePurchase = async () => {
    dismissKeyboard();

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
          try {
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
              status: 'successful',
              voucherPin: confirmed.voucherPin,
            });
          } catch (error) {
            if (error instanceof VtuPaymentStillProcessingError) {
              onSuccess({
                amount: error.amount ?? numericAmount,
                customerIdentifier: error.customerIdentifier ?? phoneNumber,
                reference: error.reference,
                status: 'processing',
              });
              return;
            }

            throw error;
          }
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
          status: 'successful',
          voucherPin: result.voucherPin,
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
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: footerSpacerHeight },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Phone Number
        </Text>

        <View style={styles.inputGroup}>
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

        {selectedProvider && !isNetworkPickerExpanded ? (
          <View
            style={[
              styles.selectedNetworkCard,
              {
                backgroundColor: `${BRAND.primary}10`,
                borderColor: BRAND.primary,
              },
            ]}
          >
            {selectedProviderConfig ? (
              <Image
                source={selectedProviderConfig.image}
                style={styles.selectedNetworkLogo}
                resizeMode="contain"
                accessibilityLabel={`${selectedProviderConfig.name} logo`}
              />
            ) : null}
            <View style={styles.selectedNetworkCopy}>
              <Text
                style={[
                  styles.selectedNetworkLabel,
                  { color: colors.textSecondary },
                ]}
              >
                Network
              </Text>
              <Text
                style={[styles.selectedNetworkName, { color: colors.text }]}
              >
                {NETWORK_PROVIDER_LABELS[selectedProvider] ?? selectedProvider}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change selected network"
              onPress={() => setIsNetworkPickerExpanded(true)}
              style={[styles.changeButton, { borderColor: BRAND.primary }]}
            >
              <Text style={styles.changeButtonText}>Change</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.networkPicker}>
            <View style={styles.networkPickerHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Select Network
              </Text>
              {!isNetworkPickerExpanded ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Choose network manually"
                  onPress={() => setIsNetworkPickerExpanded(true)}
                  style={[styles.inlineButton, { borderColor: colors.border }]}
                >
                  <Text
                    style={[styles.inlineButtonText, { color: colors.text }]}
                  >
                    Choose manually
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <ProviderGrid
              selectedProvider={selectedProvider}
              onSelect={handleProviderSelect}
            />
          </View>
        )}

        <View style={styles.inputGroup}>
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
            placeholder="1,000"
            placeholderTextColor={colors.placeholder}
            keyboardType="number-pad"
            value={formattedAmount}
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

        <View
          onLayout={(event) => {
            if (!shouldScrollToPayment) {
              return;
            }

            const paymentY = event.nativeEvent.layout.y;
            setShouldScrollToPayment(false);
            requestAnimationFrame(() => {
              scrollViewRef.current?.scrollTo({
                animated: true,
                y: Math.max(paymentY - SPACING.md, 0),
              });
            });
          }}
        >
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
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            borderTopColor: colors.border,
            backgroundColor: colors.muted,
            bottom: footerBottomOffset,
            paddingBottom: isKeyboardVisible
              ? SPACING.sm
              : Math.max(insets.bottom, SPACING.md),
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
  changeButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 14,
  },
  changeButtonText: {
    color: BRAND.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  inlineButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 32,
    paddingHorizontal: 12,
  },
  inlineButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  networkPicker: {
    marginBottom: 16,
  },
  networkPickerHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
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
  selectedNetworkCard: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginBottom: 16,
    padding: 14,
  },
  selectedNetworkCopy: {
    flex: 1,
    gap: 2,
  },
  selectedNetworkLogo: {
    height: 34,
    width: 52,
  },
  selectedNetworkLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  selectedNetworkName: {
    fontSize: 15,
    fontWeight: '700',
  },
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
