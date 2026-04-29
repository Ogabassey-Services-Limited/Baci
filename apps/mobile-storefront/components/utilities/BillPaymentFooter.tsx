import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Colors, { BRAND, SPACING } from '@/constants/Colors';
import type { useUtilityPayment } from '@/hooks/use-utility-payment';
import { billFormStyles as styles } from './bill-form-styles';

type PaymentState = ReturnType<typeof useUtilityPayment>;

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
  );
}
