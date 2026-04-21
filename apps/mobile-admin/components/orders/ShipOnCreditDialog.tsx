import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppDialogModal } from '@/components/ui/AppDialogModal';
import {
  RADIUS,
  SPACING,
  type ThemeColors,
  TYPOGRAPHY,
} from '@/constants/theme';

interface ShipOnCreditDialogProps {
  colors: Pick<
    ThemeColors,
    'border' | 'card' | 'text' | 'textOnPrimary' | 'textSecondary' | 'warning'
  >;
  creditNotes: string;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onCreditNotesChange: (value: string) => void;
  visible: boolean;
}

export function ShipOnCreditDialog({
  colors,
  creditNotes,
  isSubmitting,
  onClose,
  onConfirm,
  onCreditNotesChange,
  visible,
}: ShipOnCreditDialogProps) {
  return (
    <AppDialogModal keyboardAware onClose={onClose} visible={visible}>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Ionicons
          color={colors.warning}
          name="alert-circle"
          size={48}
          style={styles.icon}
        />
        <Text style={[styles.title, { color: colors.text }]}>
          Ship on Credit?
        </Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          This order has not been paid yet. Confirm to ship on credit and create
          a virtual account for payment.
        </Text>
        <TextInput
          accessibilityLabel="Credit note"
          multiline
          onChangeText={onCreditNotesChange}
          placeholder="e.g., Trusted customer, will pay on delivery"
          placeholderTextColor={colors.textSecondary}
          style={[
            styles.input,
            { borderColor: colors.border, color: colors.text },
          ]}
          value={creditNotes}
        />
        <Pressable
          accessibilityLabel="Confirm ship on credit"
          accessibilityRole="button"
          disabled={isSubmitting}
          onPress={onConfirm}
          style={[styles.confirmButton, { backgroundColor: colors.warning }]}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.textOnPrimary} size="small" />
          ) : (
            <Text style={[styles.confirmText, { color: colors.textOnPrimary }]}>
              Confirm Ship on Credit
            </Text>
          )}
        </Pressable>
        <Pressable
          accessibilityLabel="Cancel ship on credit"
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
  input: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.lg,
    minHeight: 96,
    padding: SPACING.md,
    textAlignVertical: 'top',
  },
  confirmButton: {
    alignItems: 'center',
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    marginBottom: SPACING.sm,
    minHeight: 48,
    paddingHorizontal: SPACING.md,
  },
  confirmText: {
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
