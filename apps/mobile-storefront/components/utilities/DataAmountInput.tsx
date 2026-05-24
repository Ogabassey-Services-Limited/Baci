import { Text, TextInput, View } from 'react-native';
import type Colors from '@/constants/Colors';
import { dataFormStyles } from './data-form.styles';
import { formatUtilityAmountInput } from './utility-amount-format';

interface DataAmountInputProps {
  amount: number;
  colors: typeof Colors.light;
  isFixedAmount: boolean;
  onChangeAmount: (amount: number) => void;
}

export function DataAmountInput({
  amount,
  colors,
  isFixedAmount,
  onChangeAmount,
}: DataAmountInputProps) {
  return (
    <View style={[dataFormStyles.inputGroup, { marginTop: 16 }]}>
      <Text style={[dataFormStyles.label, { color: colors.textSecondary }]}>
        {isFixedAmount ? 'Amount' : 'Amount (₦)'}
      </Text>
      <TextInput
        style={[
          dataFormStyles.input,
          {
            backgroundColor: colors.muted,
            color: colors.text,
            borderColor: colors.border,
          },
        ]}
        placeholder="Enter amount"
        placeholderTextColor={colors.placeholder}
        keyboardType="number-pad"
        accessibilityLabel="Amount"
        editable={!isFixedAmount}
        value={formatUtilityAmountInput(amount)}
        onChangeText={(text) => {
          if (isFixedAmount) {
            return;
          }
          const digits = text.replace(/\D/g, '');
          onChangeAmount(digits ? Number(digits) : 0);
        }}
      />
    </View>
  );
}
