import Ionicons from '@react-native-vector-icons/ionicons';
import {
  ActivityIndicator,
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import {
  RADIUS,
  SPACING,
  type ThemeColors,
  TYPOGRAPHY,
} from '@/constants/theme';
import type { PaystackBank } from '@/hooks/usePaystackBanks';

interface PayoutBankDetailsFormProps {
  accountName: string | null;
  accountNumber: string;
  colors: Pick<
    ThemeColors,
    | 'background'
    | 'border'
    | 'card'
    | 'error'
    | 'info'
    | 'infoLight'
    | 'primary'
    | 'success'
    | 'successLight'
    | 'text'
    | 'textMuted'
    | 'textSecondary'
  >;
  isVerifying: boolean;
  onAccountNumberChange: (accountNumber: string) => void;
  onOpenBankPicker: () => void;
  selectedBank: PaystackBank | null;
  shadows: StyleProp<ViewStyle>;
  verifyError: string | null;
}

export function PayoutBankDetailsForm({
  accountName,
  accountNumber,
  colors,
  isVerifying,
  onAccountNumberChange,
  onOpenBankPicker,
  selectedBank,
  shadows,
  verifyError,
}: PayoutBankDetailsFormProps) {
  return (
    <>
      <View style={[styles.card, { backgroundColor: colors.card }, shadows]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Bank Details
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Where should we send your payouts?
        </Text>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Bank Name
          </Text>
          <Pressable
            accessibilityHint="Opens a modal to search and select your bank"
            accessibilityLabel="Select bank"
            accessibilityRole="button"
            onPress={onOpenBankPicker}
            style={[
              styles.selectRef,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              style={{
                color: selectedBank ? colors.text : colors.textMuted,
                fontSize: TYPOGRAPHY.size.md,
              }}
            >
              {selectedBank?.name || 'Select your bank'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Account Number
          </Text>
          <TextInput
            keyboardType="number-pad"
            maxLength={10}
            onChangeText={(text) =>
              onAccountNumberChange(text.replace(/[^0-9]/g, ''))
            }
            placeholder="0123456789"
            placeholderTextColor={colors.textMuted}
            style={[
              styles.input,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            value={accountNumber}
          />

          {isVerifying ? (
            <View style={styles.verificationContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text
                style={[
                  styles.verificationText,
                  { color: colors.textSecondary },
                ]}
              >
                Verifying account…
              </Text>
            </View>
          ) : null}

          {accountName ? (
            <View
              style={[
                styles.verificationContainer,
                styles.successContainer,
                { backgroundColor: colors.successLight },
              ]}
            >
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={colors.success}
              />
              <Text
                style={[styles.verificationText, { color: colors.success }]}
              >
                {accountName}
              </Text>
            </View>
          ) : null}

          {verifyError ? (
            <View style={styles.verificationContainer}>
              <Ionicons name="alert-circle" size={16} color={colors.error} />
              <Text style={[styles.verificationText, { color: colors.error }]}>
                {verifyError}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={[styles.noteCard, { backgroundColor: colors.infoLight }]}>
        <Ionicons name="information-circle" size={20} color={colors.info} />
        <Text style={[styles.noteText, { color: colors.info }]}>
          Please ensure your bank details match your registered business name to
          avoid settlement issues.
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
  },
  sectionTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.lg,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.sm,
    marginBottom: SPACING.xl,
  },
  inputGroup: { marginBottom: SPACING.lg },
  label: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.sm,
    marginBottom: SPACING.xs,
  },
  input: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    fontSize: TYPOGRAPHY.size.md,
    height: 48,
    paddingHorizontal: SPACING.md,
  },
  selectRef: {
    alignItems: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: 'row',
    height: 48,
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
  },
  noteCard: {
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.md,
  },
  noteText: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.sm,
    lineHeight: 20,
  },
  verificationContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  successContainer: {
    alignSelf: 'flex-start',
    borderRadius: RADIUS.sm,
    padding: SPACING.xs,
  },
  verificationText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.sm,
  },
});
