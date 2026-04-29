import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text } from 'react-native';
import Colors, { BRAND } from '@/constants/Colors';
import { shareUtilityReceipt } from '@/lib/utility-receipt';
import { styles } from './purchase-success.styles';

interface ReceiptShareButtonProps {
  amount?: number;
  colors: typeof Colors.light;
  identifier: string;
  status: 'processing' | 'successful';
  txReference: string | null;
  type: string;
  voucherPin?: string;
}

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
  );
}
