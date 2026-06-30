import Ionicons from '@react-native-vector-icons/ionicons';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { ReceiptPreviewModal } from '@/components/receipts/ReceiptPreviewModal';
import type Colors from '@/constants/Colors';
import { BRAND } from '@/constants/Colors';
import { useMerchantReceiptInfo } from '@/hooks/use-receipts';
import {
  buildReceiptMessage,
  buildUtilityReceiptHtml,
  type UtilityReceiptData,
} from '@/lib/utility-receipt';
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
  address?: string | null;
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
  address,
  colors,
  identifier,
  status,
  txReference,
  type,
  voucherPin,
  network,
  customerName,
}: ReceiptShareButtonProps) {
  // Holds the receipt data while the preview is open (null = closed).
  const [receiptData, setReceiptData] = useState<UtilityReceiptData | null>(
    null
  );
  const { data: merchantInfo } = useMerchantReceiptInfo();
  const isDisabled = !txReference;
  const actionColor = colors.primary ?? BRAND.primary;

  const handleViewReceipt = () => {
    if (!txReference) return;
    const isAirtimeLike = type === 'airtime' || type === 'data';
    setReceiptData({
      amount,
      address: address ?? undefined,
      customerIdentifier: identifier,
      customerName: customerName ?? undefined,
      // No reliable purchase timestamp on the success screen — omit rather than
      // stamp the moment the preview was opened (gateway return / delay / idle).
      logoUrl: merchantInfo?.logo_url,
      merchantName: merchantInfo?.business_name,
      network: network ?? undefined,
      phoneNumber: isAirtimeLike ? identifier : undefined,
      reference: txReference,
      status,
      token: voucherPin,
      type,
    });
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
        visible={receiptData !== null}
        html={receiptData ? buildUtilityReceiptHtml(receiptData) : ''}
        shareText={receiptData ? buildReceiptMessage(receiptData) : undefined}
        documentType="receipt"
        onClose={() => setReceiptData(null)}
        isPaid={status === 'successful'}
      />
    </>
  );
}
