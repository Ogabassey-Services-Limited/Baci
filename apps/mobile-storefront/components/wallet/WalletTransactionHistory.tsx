import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { styles } from '@/components/wallet/wallet-screen.styles';
import type Colors from '@/constants/Colors';
import { formatNgnCurrency } from '@/lib/format-ngn-currency';

type WalletColors = (typeof Colors)['light'];
const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

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

function hexToRgba(hexColor: string, alpha: number) {
  const normalizedHex = hexColor.replace('#', '');
  const expandedHex =
    normalizedHex.length === 3 && /^[\da-f]{3}$/i.test(normalizedHex)
      ? normalizedHex
          .split('')
          .map((character) => `${character}${character}`)
          .join('')
      : normalizedHex;

  if (!/^[\da-f]{6}$/i.test(expandedHex)) {
    return hexColor;
  }

  const colorValue = Number.parseInt(expandedHex, 16);
  const red = (colorValue >> 16) & 255;
  const green = (colorValue >> 8) & 255;
  const blue = colorValue & 255;

  return `rgba(${red},${green},${blue},${alpha})`;
}

function formatWalletDate(dateString: string) {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  const hours = date.getHours();
  const displayHour = hours % 12 || 12;
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const meridiem = hours >= 12 ? 'PM' : 'AM';

  return `${date.getDate()} ${
    MONTH_LABELS[date.getMonth()]
  } ${date.getFullYear()}, ${displayHour}:${minutes} ${meridiem}`;
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
          const amountPrefix = isCredit ? '+' : '-';

          return (
            <View
              accessible
              accessibilityRole="text"
              accessibilityLabel={`${isCredit ? 'Credit' : 'Debit'} transaction. ${transaction.description}. ${amountPrefix}${formatNgnCurrency(transaction.amount)}. ${formatWalletDate(transaction.created_at)}.`}
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
                    backgroundColor: hexToRgba(
                      isCredit ? colors.success : colors.error,
                      0.12
                    ),
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
                {amountPrefix}
                {formatNgnCurrency(transaction.amount)}
              </Text>
            </View>
          );
        })
      )}
    </Animated.View>
  );
}
