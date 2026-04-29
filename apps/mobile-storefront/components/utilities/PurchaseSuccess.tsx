import { Ionicons } from '@expo/vector-icons';
import { type Href, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import PurchaseCashbackCard from './PurchaseCashbackCard';
import PurchaseUpsellCard from './PurchaseUpsellCard';
import PurchaseVoucherCard from './PurchaseVoucherCard';
import ReceiptShareButton from './ReceiptShareButton';
import { styles } from './purchase-success.styles';

interface CashbackInfo {
  amount: number;
  newBalance: number;
}

interface PurchaseSuccessProps {
  type: string;
  amount?: number;
  phoneNumber?: string;
  customerIdentifier?: string;
  txReference: string | null;
  cashback: CashbackInfo | null;
  isAuthenticated: boolean;
  onCreateAccount: () => void;
  status?: 'processing' | 'successful';
  voucherPin?: string;
}

const TYPE_LABELS: Record<string, string> = {
  airtime: 'airtime',
  data: 'data',
  tv: 'TV subscription',
  power: 'electricity',
  gaming: 'betting',
};

function getPurchaseMessage({
  identifier,
  isProcessing,
  type,
}: {
  identifier: string;
  isProcessing: boolean;
  type: string;
}) {
  const typeLabel = TYPE_LABELS[type] || type;

  if (isProcessing) {
    return identifier
      ? `Your ${typeLabel} payment for ${identifier} is processing. We will update your utility history shortly.`
      : `Your ${typeLabel} payment is processing. We will update your utility history shortly.`;
  }

  return identifier
    ? `Your ${typeLabel} purchase for ${identifier} was successful.`
    : `Your ${typeLabel} purchase was successful.`;
}

export function PurchaseSuccess({
  type,
  amount,
  phoneNumber,
  customerIdentifier,
  txReference,
  cashback,
  isAuthenticated,
  onCreateAccount,
  status = 'successful',
  voucherPin,
}: PurchaseSuccessProps) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const identifier = phoneNumber || customerIdentifier || '';
  const isProcessing = status === 'processing';
  const messageText = getPurchaseMessage({ identifier, isProcessing, type });

  return (
    <Animated.View entering={FadeIn} style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons
          name={isProcessing ? 'time-outline' : 'checkmark-circle'}
          size={80}
          color={BRAND.primary}
        />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>
        {isProcessing ? 'Payment Received' : 'Purchase Successful!'}
      </Text>
      <Text style={[styles.message, { color: colors.textSecondary }]}>
        {messageText}
      </Text>

      {txReference && (
        <Text style={[styles.referenceText, { color: colors.textSecondary }]}>
          Ref: {txReference}
        </Text>
      )}

      {voucherPin ? (
        <PurchaseVoucherCard colors={colors} voucherPin={voucherPin} />
      ) : null}

      {cashback ? <PurchaseCashbackCard cashback={cashback} /> : null}

      {!isAuthenticated ? (
        <PurchaseUpsellCard colors={colors} onCreateAccount={onCreateAccount} />
      ) : null}

      <ReceiptShareButton
        amount={amount}
        colors={colors}
        identifier={identifier}
        status={status}
        txReference={txReference}
        type={type}
        voucherPin={voucherPin}
      />

      <Pressable
        style={[styles.secondaryButton, { borderColor: colors.border }]}
        onPress={() => router.push('/' as Href)}
      >
        <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
          Back to Home
        </Text>
      </Pressable>
    </Animated.View>
  );
}
