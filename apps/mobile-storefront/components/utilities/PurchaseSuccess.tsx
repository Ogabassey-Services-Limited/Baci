import { Ionicons } from '@expo/vector-icons';
import { type Href, useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import PurchaseCashbackCard from './PurchaseCashbackCard';
import PurchaseUpsellCard from './PurchaseUpsellCard';
import PurchaseVoucherCard from './PurchaseVoucherCard';
import { styles } from './purchase-success.styles';
import ReceiptShareButton from './ReceiptShareButton';

interface CashbackInfo {
  amount: number;
  newBalance: number;
}

type PurchaseStatus =
  | 'processing'
  | 'successful'
  | 'failed'
  | 'error'
  | 'cancelled';
type IoniconsName = ComponentProps<typeof Ionicons>['name'];

interface PurchaseSuccessProps {
  type: string;
  amount?: number;
  phoneNumber?: string;
  customerIdentifier?: string;
  txReference: string | null;
  cashback: CashbackInfo | null;
  isAuthenticated: boolean;
  onCreateAccount: () => void;
  status?: PurchaseStatus;
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
  status,
  type,
}: {
  identifier: string;
  status: PurchaseStatus;
  type: string;
}) {
  const typeLabel = TYPE_LABELS[type] || type;

  if (status === 'processing') {
    return identifier
      ? `Your ${typeLabel} payment for ${identifier} is processing. We will update your utility history shortly.`
      : `Your ${typeLabel} payment is processing. We will update your utility history shortly.`;
  }

  if (status === 'failed') {
    return identifier
      ? `Your ${typeLabel} purchase for ${identifier} failed. Please try again or use another payment method.`
      : `Your ${typeLabel} purchase failed. Please try again or use another payment method.`;
  }

  if (status === 'cancelled') {
    return identifier
      ? `Your ${typeLabel} payment for ${identifier} was cancelled.`
      : `Your ${typeLabel} payment was cancelled.`;
  }

  if (status === 'error') {
    return identifier
      ? `We could not complete your ${typeLabel} purchase for ${identifier}. Please try again.`
      : `We could not complete your ${typeLabel} purchase. Please try again.`;
  }

  return identifier
    ? `Your ${typeLabel} purchase for ${identifier} was successful.`
    : `Your ${typeLabel} purchase was successful.`;
}

function getPurchasePresentation(status: PurchaseStatus): {
  canShareReceipt: boolean;
  iconName: IoniconsName;
  isProcessing: boolean;
  title: string;
} {
  switch (status) {
    case 'processing':
      return {
        canShareReceipt: true,
        iconName: 'time-outline',
        isProcessing: true,
        title: 'Payment Received',
      };
    case 'failed':
      return {
        canShareReceipt: false,
        iconName: 'alert-circle',
        isProcessing: false,
        title: 'Purchase Failed',
      };
    case 'error':
      return {
        canShareReceipt: false,
        iconName: 'alert-circle',
        isProcessing: false,
        title: 'Purchase Error',
      };
    case 'cancelled':
      return {
        canShareReceipt: false,
        iconName: 'close-circle',
        isProcessing: false,
        title: 'Payment Cancelled',
      };
    case 'successful':
      return {
        canShareReceipt: true,
        iconName: 'checkmark-circle',
        isProcessing: false,
        title: 'Purchase Successful!',
      };
    default: {
      const exhaustiveStatus: never = status;
      throw new Error(`Unhandled purchase status: ${exhaustiveStatus}`);
    }
  }
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
  const presentation = getPurchasePresentation(status);
  const receiptStatus = presentation.isProcessing ? 'processing' : 'successful';
  const messageText = getPurchaseMessage({ identifier, status, type });

  return (
    <Animated.View entering={FadeIn} style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons
          name={presentation.iconName}
          size={80}
          color={BRAND.primary}
        />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>
        {presentation.title}
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

      {presentation.canShareReceipt ? (
        <ReceiptShareButton
          amount={amount}
          colors={colors}
          identifier={identifier}
          status={receiptStatus}
          txReference={txReference}
          type={type}
          voucherPin={voucherPin}
        />
      ) : null}

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
