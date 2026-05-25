import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type Colors from '@/constants/Colors';
import { BRAND } from '@/constants/Colors';
import { styles } from './bank-transfer.styles';

interface BankTransferViewProps {
  accountName?: string;
  accountNumber?: string;
  amount?: string;
  bankName?: string;
  colors: typeof Colors.light;
  copiedField: string | null;
  error: string | null;
  isSubmitting: boolean;
  isValid: boolean;
  onBack: () => void;
  onConfirmTransfer: () => void;
  onCopyAccountName: () => void;
  onCopyAccountNumber: () => void;
  onCopyBankName: () => void;
}

interface DetailRowProps {
  colors: typeof Colors.light;
  copied: boolean;
  label: string;
  onCopy: () => void;
  value: string;
}

function formatNairaAmount(amount?: string) {
  if (!amount) return '--';
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) return '--';
  return numericAmount.toLocaleString();
}

function DetailRow({ colors, copied, label, onCopy, value }: DetailRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.textColumn}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {label}
        </Text>
        <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Copy ${label.toLowerCase()}`}
        accessibilityHint={copied ? 'Copied to clipboard' : undefined}
        onPress={onCopy}
        style={styles.copyButton}
      >
        <Ionicons
          name={copied ? 'checkmark' : 'copy-outline'}
          size={20}
          color={copied ? colors.success : BRAND.primary}
        />
      </Pressable>
    </View>
  );
}

export function BankTransferView({
  accountName,
  accountNumber,
  amount,
  bankName,
  colors,
  copiedField,
  error,
  isSubmitting,
  isValid,
  onBack,
  onConfirmTransfer,
  onCopyAccountName,
  onCopyAccountNumber,
  onCopyBankName,
}: BankTransferViewProps) {
  if (!isValid) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.centeredContent}>
          <Ionicons name="alert-circle" size={64} color={BRAND.primary} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>
            Invalid Transfer Details
          </Text>
          <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>
            {error}
          </Text>
          <Pressable
            accessibilityLabel="Go Back"
            accessibilityRole="button"
            style={[styles.primaryButton, { backgroundColor: BRAND.primary }]}
            onPress={onBack}
          >
            <Text
              style={[styles.primaryButtonText, { color: BRAND.onPrimary }]}
            >
              Go Back
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={styles.content}>
        <View
          style={[
            styles.amountCard,
            { backgroundColor: BRAND.primaryAlpha06 },
          ]}
        >
          <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>
            Transfer exactly
          </Text>
          <Text style={[styles.amountValue, { color: BRAND.primary }]}>
            {'\u20A6'}
            {formatNairaAmount(amount)}
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Account Details
        </Text>

        <View
          style={[
            styles.detailsCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <DetailRow
            label="Bank"
            value={bankName || ''}
            colors={colors}
            onCopy={onCopyBankName}
            copied={copiedField === 'bank'}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <DetailRow
            label="Account Number"
            value={accountNumber || ''}
            colors={colors}
            onCopy={onCopyAccountNumber}
            copied={copiedField === 'account'}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <DetailRow
            label="Account Name"
            value={accountName || ''}
            colors={colors}
            onCopy={onCopyAccountName}
            copied={copiedField === 'name'}
          />
        </View>

        <View style={styles.instructions}>
          <View style={styles.instructionRow}>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={colors.textSecondary}
            />
            <Text
              style={[styles.instructionText, { color: colors.textSecondary }]}
            >
              This is a one-time account. Transfer the exact amount shown above.
            </Text>
          </View>
          <View style={styles.instructionRow}>
            <Ionicons
              name="time-outline"
              size={18}
              color={colors.textSecondary}
            />
            <Text
              style={[styles.instructionText, { color: colors.textSecondary }]}
            >
              Payment is confirmed automatically once received.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[
            styles.primaryButton,
            {
              backgroundColor: BRAND.primary,
              opacity: isSubmitting ? 0.6 : 1,
            },
          ]}
          onPress={onConfirmTransfer}
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel="Confirm I've sent the money"
          accessibilityState={{ disabled: isSubmitting }}
        >
          <Text style={[styles.primaryButtonText, { color: BRAND.onPrimary }]}>
            {isSubmitting ? 'Processing...' : "I've Sent the Money"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
