import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppDialogModal } from '@/components/ui/AppDialogModal';
import {
  RADIUS,
  SPACING,
  type ThemeColors,
  TYPOGRAPHY,
} from '@/constants/theme';

interface OrderPaymentOptionDialogProps {
  balanceLabel: string;
  colors: Pick<
    ThemeColors,
    'border' | 'card' | 'primary' | 'text' | 'textOnPrimary' | 'textSecondary'
  >;
  onClose: () => void;
  onRecordPayment: () => void;
  onShipOnCredit: () => void;
  visible: boolean;
}

export function OrderPaymentOptionDialog({
  balanceLabel,
  colors,
  onClose,
  onRecordPayment,
  onShipOnCredit,
  visible,
}: OrderPaymentOptionDialogProps) {
  return (
    <AppDialogModal onClose={onClose} visible={visible}>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Ionicons
          color={colors.primary}
          name="card-outline"
          size={48}
          style={styles.icon}
        />
        <Text style={[styles.title, { color: colors.text }]}>
          Processing Unpaid Order
        </Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          This order has an outstanding balance of {balanceLabel}.
        </Text>
        <Pressable
          accessibilityLabel="Record manual payment"
          accessibilityRole="button"
          onPress={onRecordPayment}
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.primaryText, { color: colors.textOnPrimary }]}>
            Record Manual Payment
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Ship on credit"
          accessibilityRole="button"
          onPress={onShipOnCredit}
          style={[styles.secondaryButton, { borderColor: colors.primary }]}
        >
          <Text style={[styles.secondaryText, { color: colors.primary }]}>
            Ship on Credit
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Cancel payment option dialog"
          accessibilityRole="button"
          onPress={onClose}
          style={styles.cancelButton}
        >
          <Text style={[styles.cancelText, { color: colors.textSecondary }]}>
            Cancel
          </Text>
        </Pressable>
      </View>
    </AppDialogModal>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.xl,
    maxWidth: 420,
    padding: SPACING.xl,
    width: '100%',
  },
  icon: {
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },
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
  primaryButton: {
    alignItems: 'center',
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    marginBottom: SPACING.sm,
    minHeight: 48,
  },
  primaryText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.md,
  },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    justifyContent: 'center',
    marginBottom: SPACING.sm,
    minHeight: 48,
  },
  secondaryText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.md,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  cancelText: {
    fontSize: TYPOGRAPHY.size.md,
  },
});
