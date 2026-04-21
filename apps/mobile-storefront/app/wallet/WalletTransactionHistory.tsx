import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import type Colors from '@/constants/Colors';
import { formatNgnCurrency } from '@/lib/format-ngn-currency';
import { styles } from './wallet.styles';

type WalletColors = (typeof Colors)['light'];

export interface WalletTransaction {
  amount: number;
  created_at: string;
  description: string;
  id: string;
  type: 'credit' | 'debit';
}

interface WalletTransactionHistoryProps {
  colors: WalletColors;
  transactions: WalletTransaction[];
}

function formatWalletDate(dateString: string) {
  return new Date(dateString).toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function WalletTransactionHistory({
  colors,
  transactions,
}: WalletTransactionHistoryProps) {
  return (
    <Animated.View
      entering={FadeIn.duration(400).delay(200)}
      style={[styles.historySection, { backgroundColor: colors.card }]}
    >
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Recent Transactions
      </Text>

      {transactions.length === 0 ? (
        <View style={styles.emptyTransactions}>
          <Ionicons
            accessible={false}
            importantForAccessibility="no"
            name="receipt-outline"
            size={40}
            color={colors.textSecondary}
          />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No transactions yet
          </Text>
        </View>
      ) : (
        transactions.map((transaction) => {
          const isCredit = transaction.type === 'credit';

          return (
            <View
              accessible
              accessibilityRole="text"
              accessibilityLabel={`${isCredit ? 'Credit' : 'Debit'} transaction. ${transaction.description}. ${formatNgnCurrency(transaction.amount)}. ${formatWalletDate(transaction.created_at)}.`}
              key={transaction.id}
              style={[
                styles.transactionItem,
                { borderBottomColor: colors.border },
              ]}
            >
              <View
                style={[
                  styles.txIcon,
                  {
                    backgroundColor: isCredit
                      ? 'rgba(16,185,129,0.12)'
                      : 'rgba(239,68,68,0.12)',
                  },
                ]}
              >
                <Ionicons
                  accessible={false}
                  importantForAccessibility="no"
                  name={isCredit ? 'arrow-down' : 'arrow-up'}
                  size={18}
                  color={isCredit ? colors.success : colors.error}
                />
              </View>
              <View style={styles.txDetails}>
                <Text style={[styles.txDescription, { color: colors.text }]}>
                  {transaction.description}
                </Text>
                <Text style={[styles.txDate, { color: colors.textSecondary }]}>
                  {formatWalletDate(transaction.created_at)}
                </Text>
              </View>
              <Text
                style={[
                  styles.txAmount,
                  { color: isCredit ? colors.success : colors.error },
                ]}
              >
                {isCredit ? '+' : '-'}
                {formatNgnCurrency(transaction.amount)}
              </Text>
            </View>
          );
        })
      )}
    </Animated.View>
  );
}
