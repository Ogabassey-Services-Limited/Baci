import Ionicons from '@react-native-vector-icons/ionicons';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { ReceiptPreviewModal } from '@/components/receipts/ReceiptPreviewModal';
import type Colors from '@/constants/Colors';
import { BRAND } from '@/constants/Colors';
import { buildUtilityReceiptHtml } from '@/lib/utility-receipt';
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
  network?: string | null;
  customerName?: string | null;
}

export default function ReceiptShareButton({
  amount,
  colors,
  identifier,
  status,
  txReference,
  type,
  voucherPin,
  network,
  customerName,
}: ReceiptShareButtonProps) {
  // Holds the rendered receipt HTML while the preview is open (null = closed).
  const [receiptHtml, setReceiptHtml] = useState<string | null>(null);
  const isDisabled = !txReference;
  const actionColor = colors.primary ?? BRAND.primary;

  const handleViewReceipt = () => {
    if (!txReference) return;
    const isAirtimeLike = type === 'airtime' || type === 'data';
    setReceiptHtml(
      buildUtilityReceiptHtml({
        amount,
        customerIdentifier: identifier,
        customerName: customerName ?? undefined,
        dateTime: new Date().toISOString(),
        network: network ?? undefined,
        phoneNumber: isAirtimeLike ? identifier : undefined,
        reference: txReference,
        status,
        token: voucherPin,
        type,
      })
    );
  };

  return (
    <>
      <Pressable
        style={[
          styles.shareButton,
          { borderColor: colors.border, opacity: isDisabled ? 0.45 : 1 },
        ]}
        onPress={handleViewReceipt}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel="View utility receipt"
        accessibilityState={{ disabled: isDisabled }}
      >
        <Ionicons name="receipt-outline" size={18} color={actionColor} />
        <Text style={styles.shareButtonText}>View receipt</Text>
      </Pressable>
      <ReceiptPreviewModal
        visible={receiptHtml !== null}
        html={receiptHtml ?? ''}
        onClose={() => setReceiptHtml(null)}
        isPaid={status === 'successful'}
      />
    </>
  );
}
