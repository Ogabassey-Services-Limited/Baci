import { Ionicons } from '@expo/vector-icons';
import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, SPACING } from '@/constants/Colors';
import { setClipboardString } from '@/lib/clipboard';
import { shareUtilityReceipt } from '@/lib/utility-receipt';

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
  const [isSharingReceipt, setIsSharingReceipt] = useState(false);

  const handleCopyVoucher = async () => {
    if (!voucherPin) {
      return;
    }

    try {
      const copied = await setClipboardString(voucherPin);
      Alert.alert(
        copied ? 'Copied' : 'Copy Failed',
        copied ? 'Token copied to clipboard.' : 'Could not copy this token.'
      );
    } catch (copyError) {
      console.error('Failed to copy utility voucher token:', copyError);
      Alert.alert('Copy Failed', 'Could not copy this token.');
    }
  };

  const handleShareReceipt = async () => {
    if (isSharingReceipt) {
      return;
    }

    setIsSharingReceipt(true);
    try {
      await shareUtilityReceipt({
        amount,
        customerIdentifier: identifier,
        reference: txReference,
        status,
        type,
        voucherPin,
      });
    } catch (shareError) {
      console.error('Failed to share utility receipt:', shareError);
      Alert.alert(
        'Share Failed',
        'Could not generate the receipt PDF. Please try again.'
      );
    } finally {
      setIsSharingReceipt(false);
    }
  };

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
        {isProcessing
          ? identifier
            ? `Your ${TYPE_LABELS[type] || type} payment for ${identifier} is processing. We will update your utility history shortly.`
            : `Your ${TYPE_LABELS[type] || type} payment is processing. We will update your utility history shortly.`
          : identifier
            ? `Your ${TYPE_LABELS[type] || type} purchase for ${identifier} was successful.`
            : `Your ${TYPE_LABELS[type] || type} purchase was successful.`}
      </Text>

      {txReference && (
        <Text style={[styles.referenceText, { color: colors.textSecondary }]}>
          Ref: {txReference}
        </Text>
      )}

      {voucherPin ? (
        <View
          style={[
            styles.voucherCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.voucherLabel, { color: colors.textSecondary }]}>
            Voucher / Token
          </Text>
          <Text selectable style={[styles.voucherCode, { color: colors.text }]}>
            {voucherPin}
          </Text>
          <Pressable
            style={[styles.tokenButton, { borderColor: colors.border }]}
            onPress={handleCopyVoucher}
            accessibilityRole="button"
            accessibilityLabel="Copy voucher token"
          >
            <Ionicons name="copy-outline" size={17} color={BRAND.primary} />
            <Text style={styles.tokenButtonText}>Copy token</Text>
          </Pressable>
        </View>
      ) : null}

      {cashback && (
        <View style={styles.cashbackCard}>
          <Ionicons
            name="wallet-outline"
            size={20}
            color="#059669"
            style={{ marginBottom: 4 }}
          />
          <Text style={styles.cashbackAmount}>
            +₦{cashback.amount.toLocaleString()} cashback
          </Text>
          <Text style={styles.cashbackBalance}>
            Wallet balance: ₦{cashback.newBalance.toLocaleString()}
          </Text>
        </View>
      )}

      {!isAuthenticated && (
        <View
          style={[
            styles.upsellCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.upsellTitle, { color: colors.text }]}>
            Save this beneficiary?
          </Text>
          <Text style={[styles.upsellText, { color: colors.textSecondary }]}>
            Create an account to save this number, view transaction history, and
            earn loyalty points!
          </Text>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: BRAND.primary }]}
            onPress={onCreateAccount}
          >
            <Text style={styles.primaryButtonText}>Create Account</Text>
          </Pressable>
        </View>
      )}

      <Pressable
        style={[
          styles.shareButton,
          {
            borderColor: colors.border,
            opacity: isSharingReceipt ? 0.7 : 1,
          },
        ]}
        onPress={handleShareReceipt}
        disabled={isSharingReceipt}
        accessibilityRole="button"
        accessibilityLabel="Share utility receipt"
      >
        {isSharingReceipt ? (
          <ActivityIndicator size="small" color={BRAND.primary} />
        ) : (
          <Ionicons name="share-outline" size={18} color={BRAND.primary} />
        )}
        <Text style={styles.shareButtonText}>
          {isSharingReceipt ? 'Generating receipt...' : 'Share receipt'}
        </Text>
      </Pressable>

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  iconContainer: { marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  message: { fontSize: 16, textAlign: 'center', marginBottom: 32 },
  referenceText: {
    fontSize: 13,
    textAlign: 'center' as const,
    marginBottom: 24,
  },
  voucherCard: {
    width: '100%',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  voucherLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  voucherCode: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0,
  },
  cashbackCard: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center' as const,
    marginBottom: 24,
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  cashbackAmount: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#059669',
  },
  cashbackBalance: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  upsellCard: {
    width: '100%',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  upsellTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  upsellText: { fontSize: 14, marginBottom: 16 },
  primaryButton: {
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  secondaryButton: {
    width: '100%',
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  secondaryButtonText: { fontSize: 16, fontWeight: '600' },
  shareButton: {
    width: '100%',
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  shareButtonText: {
    color: BRAND.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  tokenButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 36,
    paddingHorizontal: 14,
  },
  tokenButtonText: {
    color: BRAND.primary,
    fontSize: 13,
    fontWeight: '700',
  },
});
