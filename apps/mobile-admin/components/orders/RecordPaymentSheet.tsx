import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppSheetModal } from '@/components/ui/AppSheetModal';
import {
  RADIUS,
  SPACING,
  type ThemeColors,
  TYPOGRAPHY,
} from '@/constants/theme';

interface RecordPaymentSheetProps {
  colors: Pick<
    ThemeColors,
    | 'border'
    | 'card'
    | 'primary'
    | 'success'
    | 'text'
    | 'textOnPrimary'
    | 'textSecondary'
  >;
  currencySymbol: string;
  isConfirmDisabled: boolean;
  isSubmitting: boolean;
  onAmountChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  onMethodChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  paymentAmount: string;
  paymentMethod: string;
  paymentNotes: string;
  visible: boolean;
}

const PAYMENT_METHODS = ['transfer', 'pos', 'cash'] as const;

export function RecordPaymentSheet({
  colors,
  currencySymbol,
  isConfirmDisabled,
  isSubmitting,
  onAmountChange,
  onClose,
  onConfirm,
  onMethodChange,
  onNotesChange,
  paymentAmount,
  paymentMethod,
  paymentNotes,
  visible,
}: RecordPaymentSheetProps) {
  const [isAmountFocused, setIsAmountFocused] = useState(false);

  // Show raw digits while editing so toLocaleString commas don't cause NaN.
  // Display the formatted value only when blurred.
  const displayedAmount = isAmountFocused
    ? paymentAmount
    : paymentAmount
      ? Number(paymentAmount.replace(/,/g, '')).toLocaleString('en-NG')
      : '';

  return (
    <AppSheetModal
      accessibilityLabel="Record payment sheet"
      onClose={onClose}
      visible={visible}
    >
      <Text style={[styles.title, { color: colors.text }]}>Record Payment</Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>
        Enter payment details manually.
      </Text>

      <Text style={[styles.label, { color: colors.textSecondary }]}>
        Amount Paid
      </Text>
      <View style={[styles.inputRow, { borderColor: colors.border }]}>
        <Text style={[styles.currencyPrefix, { color: colors.textSecondary }]}>
          {currencySymbol}
        </Text>
        <TextInput
          accessibilityLabel="Payment amount"
          keyboardType="numeric"
          onBlur={() => setIsAmountFocused(false)}
          onChangeText={(text) => {
            const digits = text.replace(/[^0-9.]/g, '');
            const parts = digits.split('.');
            const normalized =
              parts.length > 1
                ? `${parts[0]}.${parts.slice(1).join('').slice(0, 2)}`
                : parts[0];
            onAmountChange(normalized);
          }}
          onFocus={() => setIsAmountFocused(true)}
          placeholder="0"
          placeholderTextColor={colors.textSecondary}
          style={[styles.inputInner, { color: colors.text }]}
          value={displayedAmount}
        />
      </View>

      <Text style={[styles.label, { color: colors.textSecondary }]}>
        Payment Method
      </Text>
      <View style={styles.methodRow}>
        {PAYMENT_METHODS.map((method) => {
          const isSelected = paymentMethod === method;

          return (
            <Pressable
              key={method}
              accessibilityLabel={`Payment method ${method}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => onMethodChange(method)}
              style={[
                styles.methodButton,
                {
                  backgroundColor: isSelected ? colors.primary : colors.card,
                  borderColor: isSelected ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.methodText,
                  { color: isSelected ? colors.textOnPrimary : colors.text },
                ]}
              >
                {method === 'pos' ? 'POS' : method}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.label, { color: colors.textSecondary }]}>
        Notes (Optional)
      </Text>
      <TextInput
        accessibilityLabel="Payment notes"
        maxLength={500}
        onChangeText={onNotesChange}
        placeholder="E.g., Received by John"
        placeholderTextColor={colors.textSecondary}
        style={[
          styles.input,
          { borderColor: colors.border, color: colors.text },
        ]}
        value={paymentNotes}
      />

      <Pressable
        accessibilityLabel="Confirm payment"
        accessibilityRole="button"
        disabled={isConfirmDisabled || isSubmitting}
        onPress={onConfirm}
        style={[
          styles.confirmButton,
          {
            backgroundColor: colors.success,
            opacity: isConfirmDisabled || isSubmitting ? 0.5 : 1,
          },
        ]}
      >
        {isSubmitting ? (
          <ActivityIndicator color={colors.textOnPrimary} />
        ) : (
          <Text style={[styles.confirmText, { color: colors.textOnPrimary }]}>
            Confirm Payment
          </Text>
        )}
      </Pressable>
    </AppSheetModal>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size['2xl'],
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  description: {
    fontSize: TYPOGRAPHY.size.md,
    lineHeight: 22,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  label: {
    fontSize: TYPOGRAPHY.size.md,
    marginBottom: SPACING.sm,
  },
  input: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    fontSize: TYPOGRAPHY.size.lg,
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  inputRow: {
    alignItems: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },
  currencyPrefix: {
    fontSize: TYPOGRAPHY.size.lg,
    paddingRight: SPACING.xs,
  },
  inputInner: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.lg,
    paddingVertical: SPACING.md,
  },
  methodRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  methodButton: {
    alignItems: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
  },
  methodText: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  confirmButton: {
    alignItems: 'center',
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    minHeight: 48,
  },
  confirmText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.md,
  },
});
