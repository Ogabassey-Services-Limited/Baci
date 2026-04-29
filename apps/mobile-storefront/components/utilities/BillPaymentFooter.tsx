import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { billFormStyles as styles } from '@/components/utilities/bill-form-styles';
import type Colors from '@/constants/Colors';
import { BRAND, SPACING } from '@/constants/Colors';
import type { useUtilityPayment } from '@/hooks/use-utility-payment';

type PaymentState = ReturnType<typeof useUtilityPayment>;

const BILL_PAYMENT_AMOUNT_FORMATTER = new Intl.NumberFormat('en-NG', {
  currency: 'NGN',
  currencyDisplay: 'narrowSymbol',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
  style: 'currency',
});

interface BillPaymentFooterProps {
  colors: typeof Colors.light;
  footerBottomOffset: number;
  insetsBottom: number;
  isBusy: boolean;
  isKeyboardVisible: boolean;
  numericAmount: number;
  onPurchase: () => void;
  payment: PaymentState;
}

export function BillPaymentFooter({
  colors,
  footerBottomOffset,
  insetsBottom,
  isBusy,
  isKeyboardVisible,
  numericAmount,
  onPurchase,
  payment,
}: BillPaymentFooterProps) {
  const paymentLabel = payment.selectedSavedCardId
    ? `Pay ${BILL_PAYMENT_AMOUNT_FORMATTER.format(numericAmount || 0)}`
    : 'Continue to Payment';

  return (
    <View
      style={[
        styles.footer,
        {
          borderTopColor: colors.border,
          backgroundColor: colors.muted,
          bottom: footerBottomOffset,
          paddingBottom: isKeyboardVisible
            ? SPACING.sm
            : Math.max(insetsBottom, SPACING.md),
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
        onPress={onPurchase}
        disabled={isBusy}
        accessibilityRole="button"
        accessibilityLabel={paymentLabel}
        accessibilityState={{ busy: isBusy, disabled: isBusy }}
      >
        {isBusy ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Text style={styles.payButtonText}>{paymentLabel}</Text>
        )}
      </Pressable>
    </View>
  );
}
