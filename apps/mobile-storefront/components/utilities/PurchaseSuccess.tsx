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
  voucherPin?: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  airtime: 'airtime',
  data: 'data',
  tv: 'TV subscription',
  power: 'electricity',
  gaming: 'betting',
};

function isTokenGeneratingType(type: string) {
  return type === 'power' || type === 'tv' || type === 'gaming';
}

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

  switch (status) {
    case 'processing': {
      const action = isTokenGeneratingType(type)
        ? 'generating your token'
        : 'completing your purchase';
      return identifier
        ? `Your ${typeLabel} payment for ${identifier} was received. We are ${action} now.`
        : `Your ${typeLabel} payment was received. We are ${action} now.`;
    }
    case 'failed':
      return identifier
        ? `Your ${typeLabel} purchase for ${identifier} failed. Please try again or use another payment method.`
        : `Your ${typeLabel} purchase failed. Please try again or use another payment method.`;
    case 'cancelled':
      return identifier
        ? `Your ${typeLabel} payment for ${identifier} was cancelled.`
        : `Your ${typeLabel} payment was cancelled.`;
    case 'error':
      return identifier
        ? `We could not complete your ${typeLabel} purchase for ${identifier}. Please try again.`
        : `We could not complete your ${typeLabel} purchase. Please try again.`;
    case 'successful':
      return identifier
        ? `Your ${typeLabel} purchase for ${identifier} was successful.`
        : `Your ${typeLabel} purchase was successful.`;
    default:
      return assertNever(status);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled purchase status: ${value}`);
}

function getReceiptStatus(
  status: PurchaseStatus
): 'processing' | 'successful' | null {
  switch (status) {
    case 'processing':
      return 'processing';
    case 'successful':
      return 'successful';
    case 'failed':
    case 'error':
    case 'cancelled':
      return null;
    default:
      return assertNever(status);
  }
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
    default:
      return assertNever(status);
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
  const receiptStatus = getReceiptStatus(status);
  const messageText = getPurchaseMessage({ identifier, status, type });
  const isTokenGenerating = isTokenGeneratingType(type);
  const processingNoticeTitle = isTokenGenerating
    ? 'Generating your token'
    : 'Completing your purchase';
  const processingNoticeText = isTokenGenerating
    ? "This usually takes 30-60 seconds. You can leave this screen; we'll notify you when the token is ready."
    : "This can take a minute. You can leave this screen; we'll update your purchase history when it is ready.";

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

      {presentation.isProcessing ? (
        <View
          style={[
            styles.processingNotice,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.processingNoticeHeader}>
            <Ionicons name="flash-outline" size={18} color={BRAND.primary} />
            <Text style={[styles.processingNoticeTitle, { color: colors.text }]}>
              {processingNoticeTitle}
            </Text>
          </View>
          <Text
            style={[
              styles.processingNoticeText,
              { color: colors.textSecondary },
            ]}
          >
            {processingNoticeText}
          </Text>
        </View>
      ) : null}

      {voucherPin ? (
        <PurchaseVoucherCard colors={colors} voucherPin={voucherPin} />
      ) : null}

      {cashback ? <PurchaseCashbackCard cashback={cashback} /> : null}

      {!isAuthenticated ? (
        <PurchaseUpsellCard colors={colors} onCreateAccount={onCreateAccount} />
      ) : null}

      {presentation.canShareReceipt && receiptStatus ? (
        <ReceiptShareButton
          amount={amount}
          colors={colors}
          identifier={identifier}
          status={receiptStatus}
          txReference={txReference}
          type={type}
          voucherPin={voucherPin ?? undefined}
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
