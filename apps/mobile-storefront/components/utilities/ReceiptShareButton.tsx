import Ionicons from '@react-native-vector-icons/ionicons';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text } from 'react-native';
import type Colors from '@/constants/Colors';
import { BRAND } from '@/constants/Colors';
import { shareUtilityReceipt } from '@/lib/utility-receipt';
import { styles } from './purchase-success.styles';

// Keeps known receipt types autocomplete-friendly while still accepting backend-added string types.
export type UtilityReceiptType =
  | 'airtime'
  | 'data'
  | 'tv'
  | 'power'
  | 'gaming'
  | (string & {});

interface ReceiptShareButtonProps {
  amount?: number;
  colors: typeof Colors.light;
  identifier: string;
  status: 'processing' | 'successful';
  txReference: string | null;
  type: UtilityReceiptType;
  voucherPin?: string;
}

// Module-scope helper: try/catch with a finally clause is not yet supported
// by React Compiler inside component bodies. Never rejects.
const shareReceiptSafely = async (
  payload: Parameters<typeof shareUtilityReceipt>[0]
) => {
  try {
    await shareUtilityReceipt(payload);
  } catch (shareError) {
    console.error('Failed to share utility receipt:', shareError);
    Alert.alert(
      'Share Failed',
      'Could not generate the receipt PDF. Please try again.'
    );
  }
};

export default function ReceiptShareButton({
  amount,
  colors,
  identifier,
  status,
  txReference,
  type,
  voucherPin,
}: ReceiptShareButtonProps) {
  const [isSharingReceipt, setIsSharingReceipt] = useState(false);
  const isShareDisabled = isSharingReceipt || !txReference;
  const actionColor = colors.primary ?? BRAND.primary;

  const handleShareReceipt = async () => {
    const reference = txReference;
    if (isSharingReceipt || !reference) {
      return;
    }

    setIsSharingReceipt(true);
    // shareReceiptSafely never rejects, so the reset below always runs
    // (same semantics as the previous finally block).
    await shareReceiptSafely({
      amount,
      customerIdentifier: identifier,
      reference,
      status,
      type,
      voucherPin,
    });
    setIsSharingReceipt(false);
  };

  return (
    <Pressable
      style={[
        styles.shareButton,
        {
          borderColor: colors.border,
          opacity: !txReference ? 0.45 : isSharingReceipt ? 0.7 : 1,
        },
      ]}
      onPress={handleShareReceipt}
      disabled={isShareDisabled}
      accessibilityRole="button"
      accessibilityLabel="Share utility receipt"
      accessibilityState={{ busy: isSharingReceipt, disabled: isShareDisabled }}
    >
      {isSharingReceipt ? (
        <ActivityIndicator size="small" color={actionColor} />
      ) : (
        <Ionicons name="share-outline" size={18} color={actionColor} />
      )}
      <Text style={styles.shareButtonText}>
        {isSharingReceipt ? 'Generating receipt...' : 'Share receipt'}
      </Text>
    </Pressable>
  );
}
