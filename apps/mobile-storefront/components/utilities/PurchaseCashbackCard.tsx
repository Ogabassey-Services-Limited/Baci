import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { palette } from '@/constants/Colors';
import { styles } from './purchase-success.styles';

const CASHBACK_AMOUNT_FORMATTER = new Intl.NumberFormat('en-NG', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
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

  return (
    <View style={styles.cashbackCard}>
      <Ionicons
        name="wallet-outline"
        size={20}
        color={palette.emerald[600]}
        style={styles.cashbackIcon}
      />
      <Text style={styles.cashbackAmount}>
        {sign}₦{formattedAmount} cashback
      </Text>
      <Text style={styles.cashbackBalance}>
        Wallet balance: ₦{CASHBACK_AMOUNT_FORMATTER.format(cashback.newBalance)}
      </Text>
    </View>
  );
}
