import { type LayoutChangeEvent, Text, TextInput, View } from 'react-native';
import Colors from '@/constants/Colors';
import type { useUtilityPayment } from '@/hooks/use-utility-payment';
import { billFormStyles as styles } from './bill-form-styles';
import { UtilityPaymentOptions } from './UtilityPaymentOptions';

type PaymentState = ReturnType<typeof useUtilityPayment>;

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
      <View style={{ marginTop: 24 }}>
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
          onChangeText={(text) => setAmount(text.replace(/\D/g, ''))}
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
