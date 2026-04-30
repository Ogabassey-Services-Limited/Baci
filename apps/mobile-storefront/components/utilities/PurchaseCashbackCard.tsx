import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { palette } from '@/constants/Colors';
import { styles } from './purchase-success.styles';

const CASHBACK_AMOUNT_FORMATTER = new Intl.NumberFormat('en-NG', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

interface PurchaseCashbackCardProps {
  cashback: {
    amount: number;
    newBalance: number;
  };
}

export default function PurchaseCashbackCard({
  cashback,
}: PurchaseCashbackCardProps) {
  const sign = cashback.amount > 0 ? '+' : cashback.amount < 0 ? '-' : '';
  const formattedAmount = CASHBACK_AMOUNT_FORMATTER.format(
    Math.abs(cashback.amount)
  );
  const balanceSign = cashback.newBalance < 0 ? '-' : '';
  const formattedBalance = CASHBACK_AMOUNT_FORMATTER.format(
    Math.abs(cashback.newBalance)
  );

  return (
    <View style={styles.cashbackCard}>
      <Ionicons
        accessible={false}
        name="wallet-outline"
        size={20}
        color={palette.emerald[600]}
        style={styles.cashbackIcon}
      />
      <Text
        accessibilityLabel={`cashback amount: ${sign}${formattedAmount} naira`}
        style={styles.cashbackAmount}
      >
        {sign}₦{formattedAmount} cashback
      </Text>
      <Text
        accessibilityLabel={`wallet balance: ${balanceSign}${formattedBalance} naira`}
        style={styles.cashbackBalance}
      >
        Wallet balance: {balanceSign}₦{formattedBalance}
      </Text>
    </View>
  );
}
