import { type LayoutChangeEvent, Text, TextInput, View } from 'react-native';
import { billFormStyles as styles } from '@/components/utilities/bill-form-styles';
import type Colors from '@/constants/Colors';
import type { useUtilityPayment } from '@/hooks/use-utility-payment';
import { UtilityPaymentOptions } from './UtilityPaymentOptions';

type PaymentState = ReturnType<typeof useUtilityPayment>;

function sanitizeAmountInput(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, '');
  const [whole = '', ...decimalParts] = cleaned.split('.');
  return `${whole}${decimalParts.length ? `.${decimalParts.join('')}` : ''}`;
}

interface BillPaymentSectionProps {
  colors: typeof Colors.light;
  formattedAmount: string;
  handlePaymentLayout: (event: LayoutChangeEvent) => void;
  isFixedAmount: boolean;
  numericAmount: number;
  payment: PaymentState;
  setAmount: (value: string) => void;
}

export function BillPaymentSection({
  colors,
  formattedAmount,
  handlePaymentLayout,
  isFixedAmount,
  numericAmount,
  payment,
  setAmount,
}: BillPaymentSectionProps) {
  return (
    <View onLayout={handlePaymentLayout}>
      <View style={styles.amountSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Amount (₦)
        </Text>
        <TextInput
          style={[
            styles.input,
            isFixedAmount && styles.inputDisabled,
            {
              backgroundColor: colors.muted,
              color: colors.text,
              borderColor: colors.border,
            },
          ]}
          placeholder={
            isFixedAmount ? 'Amount set by provider' : 'Enter amount'
          }
          placeholderTextColor={colors.placeholder}
          keyboardType="number-pad"
          value={formattedAmount}
          editable={!isFixedAmount}
          accessibilityLabel={
            isFixedAmount ? 'Payment amount read-only' : 'Payment amount'
          }
          maxLength={10}
          onChangeText={(text) => setAmount(sanitizeAmountInput(text))}
        />
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
    </View>
  );
}
