import { Pressable, Text, View } from 'react-native';
import Colors, { BRAND } from '@/constants/Colors';
import type { VTUHistoryTransaction } from '@/hooks/use-vtu-history';
import {
  UTILITY_HISTORY_STATUS_COLORS,
  UTILITY_HISTORY_STYLE_TOKENS,
  UTILITY_HISTORY_TYPE_LABELS,
} from './history.constants';
import { utilityHistoryHelpers } from './history.helpers';
import { styles } from './history.styles';

interface UtilityTransactionCardProps {
  colors: typeof Colors.light;
  handleCopyVoucher: (voucherPin: string) => void;
  handleRepeatTransaction: (transaction: VTUHistoryTransaction) => void;
  handleShareReceipt: (transaction: VTUHistoryTransaction) => void;
  handleSyncPayment: (transaction: VTUHistoryTransaction) => void;
  sharingTransactionId: string | null;
  syncingTransactionId: string | null;
  transaction: VTUHistoryTransaction;
}

export default function UtilityTransactionCard({
  colors,
  handleCopyVoucher,
  handleRepeatTransaction,
  handleShareReceipt,
  handleSyncPayment,
  sharingTransactionId,
  syncingTransactionId,
  transaction,
}: UtilityTransactionCardProps) {
  const displayStatus = utilityHistoryHelpers.getDisplayStatus(transaction);
  const hasReceivedGatewayPayment =
    transaction.status !== 'successful' &&
    transaction.payment_status === 'completed';
  const customerCashback = transaction.customer_cashback ?? 0;
  const voucherPin = transaction.voucher_pin;
  const title = utilityHistoryHelpers.getTransactionTitle(transaction);

  return (
    <View
      style={[
        styles.transactionCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.transactionHeader}>
        <View style={styles.transactionCopy}>
          <Text
            style={[styles.transactionTitle, { color: colors.text }]}
            numberOfLines={2}
          >
            {title}
          </Text>
          <Text
            style={[styles.transactionDetail, { color: colors.textSecondary }]}
          >
            {UTILITY_HISTORY_TYPE_LABELS[transaction.type]} •{' '}
            {utilityHistoryHelpers.getTransactionDetail(transaction)}
          </Text>
        </View>
        <Text style={[styles.transactionAmount, { color: colors.text }]}>
          {utilityHistoryHelpers.formatAmount(transaction.amount)}
        </Text>
      </View>

      <View style={styles.metaRow}>
        <Text style={[styles.metaText, { color: colors.textSecondary }]}>
          {utilityHistoryHelpers.formatDate(transaction.created_at)}
        </Text>
        <View
          style={[
            styles.statusPill,
            {
              backgroundColor: `${displayStatus.color}${UTILITY_HISTORY_STYLE_TOKENS.statusTintSuffix}`,
            },
          ]}
        >
          <Text style={[styles.statusText, { color: displayStatus.color }]}>
            {displayStatus.label}
          </Text>
        </View>
      </View>

      <Text style={[styles.referenceText, { color: colors.textSecondary }]}>
        Ref: {transaction.request_reference}
      </Text>

      {transaction.customer_name ? (
        <Text style={[styles.referenceText, { color: colors.textSecondary }]}>
          Verified as {transaction.customer_name}
        </Text>
      ) : null}

      {displayStatus.message ? (
        <Text
          style={[styles.paymentNoticeText, { color: displayStatus.color }]}
        >
          {displayStatus.message}
        </Text>
      ) : null}

      {voucherPin ? (
        <View
          style={[
            styles.voucherBox,
            { backgroundColor: colors.muted, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.voucherLabel, { color: colors.textSecondary }]}>
            Voucher / Token
          </Text>
          <Text selectable style={[styles.voucherCode, { color: colors.text }]}>
            {voucherPin}
          </Text>
          <Pressable
            style={[
              styles.pillButtonBase,
              styles.tokenButton,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={() => handleCopyVoucher(voucherPin)}
            accessibilityRole="button"
            accessibilityLabel="Copy voucher token"
          >
            <Text style={[styles.tokenButtonText, { color: BRAND.primary }]}>
              Copy token
            </Text>
          </Pressable>
        </View>
      ) : null}

      {customerCashback > 0 ? (
        <Text
          style={[
            styles.cashbackText,
            { color: UTILITY_HISTORY_STATUS_COLORS.successful },
          ]}
        >
          Cashback: {utilityHistoryHelpers.formatAmount(customerCashback)}
        </Text>
      ) : null}

      {transaction.error_message ? (
        <Text
          style={[
            styles.errorText,
            { color: UTILITY_HISTORY_STATUS_COLORS.failed },
          ]}
        >
          {transaction.error_message}
        </Text>
      ) : null}

      <View style={styles.actionRow}>
        {hasReceivedGatewayPayment ? null : (
          <Pressable
            style={[
              styles.pillButtonBase,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={() => handleRepeatTransaction(transaction)}
            accessibilityRole="button"
            accessibilityLabel={`Repeat ${title}`}
          >
            <Text style={[styles.repeatText, { color: BRAND.primary }]}>
              Repeat
            </Text>
          </Pressable>
        )}
        {transaction.status === 'successful' ? (
          <Pressable
            style={[
              styles.pillButtonBase,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                opacity: sharingTransactionId === transaction.id ? 0.6 : 1,
              },
            ]}
            onPress={() => handleShareReceipt(transaction)}
            disabled={sharingTransactionId === transaction.id}
            accessibilityRole="button"
            accessibilityLabel={`Share receipt for ${title}`}
          >
            <Text style={[styles.repeatText, { color: BRAND.primary }]}>
              {sharingTransactionId === transaction.id
                ? 'Sharing...'
                : 'Share receipt'}
            </Text>
          </Pressable>
        ) : null}
        {transaction.status !== 'successful' &&
        transaction.payment_gateway &&
        transaction.payment_reference ? (
          <Pressable
            style={[
              styles.pillButtonBase,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                opacity: syncingTransactionId === transaction.id ? 0.6 : 1,
              },
            ]}
            onPress={() => handleSyncPayment(transaction)}
            disabled={syncingTransactionId === transaction.id}
            accessibilityRole="button"
            accessibilityLabel={`Sync payment for ${title}`}
          >
            <Text style={[styles.repeatText, { color: BRAND.primary }]}>
              {syncingTransactionId === transaction.id
                ? 'Syncing...'
                : 'Sync payment'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
