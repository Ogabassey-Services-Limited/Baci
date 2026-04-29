import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { utilityRepeatHelpers } from '@/lib/utility-repeat';
import type { VTUHistoryTransaction } from '@/hooks/use-vtu-history';
import { setClipboardString } from '@/lib/clipboard';
import { shareUtilityReceipt } from '@/lib/utility-receipt';
import { confirmVtuCheckout } from '@/lib/vtu-checkout';

interface UseUtilityHistoryActionsInput {
  refetch: () => Promise<unknown>;
}

function getFriendlySyncErrorMessage(error: unknown) {
  if (error instanceof Error && /already completed|processing/i.test(error.message)) {
    return 'This payment is already being reconciled. Please check again shortly.';
  }

  return 'We could not reconcile this payment yet.';
}

export function useUtilityHistoryActions({
  refetch,
}: UseUtilityHistoryActionsInput) {
  const router = useRouter();
  const [sharingTransactionId, setSharingTransactionId] = useState<
    string | null
  >(null);
  const [syncingTransactionId, setSyncingTransactionId] = useState<
    string | null
  >(null);

  const handleRepeatTransaction = (transaction: VTUHistoryTransaction) => {
    router.push({
      pathname: '/utilities/[type]',
      params: utilityRepeatHelpers.getRouteParams(transaction),
      // Expo Router's generated Href type does not currently infer this
      // dynamic route object from the helper return type.
    } as unknown as Href);
  };

  const handleCopyVoucher = async (voucherPin: string) => {
    const trimmedVoucherPin = voucherPin.trim();
    if (!trimmedVoucherPin) {
      Alert.alert('Copy Failed', 'No token to copy.');
      return;
    }

    try {
      const copied = await setClipboardString(trimmedVoucherPin);
      Alert.alert(
        copied ? 'Copied' : 'Copy Failed',
        copied ? 'Token copied to clipboard.' : 'Could not copy this token.'
      );
    } catch (copyError) {
      console.error('Failed to copy utility voucher token:', copyError);
      Alert.alert('Copy Failed', 'Could not copy this token.');
    }
  };

  const handleShareReceipt = async (transaction: VTUHistoryTransaction) => {
    if (sharingTransactionId) {
      return;
    }

    const customerIdentifier =
      transaction.customer_identifier ?? transaction.phone_number;
    if (!customerIdentifier) {
      Alert.alert(
        'Cannot Share',
        'Customer identifier is missing for this transaction.'
      );
      return;
    }

    setSharingTransactionId(transaction.id);
    try {
      await shareUtilityReceipt({
        amount: transaction.amount,
        customerIdentifier,
        customerName: transaction.customer_name,
        reference: transaction.request_reference,
        status: transaction.status,
        type: utilityRepeatHelpers.getRouteType(transaction.type),
        voucherPin: transaction.voucher_pin,
      });
    } catch (shareError) {
      console.error('Failed to share utility receipt:', shareError);
      Alert.alert(
        'Share Failed',
        'Could not generate the receipt PDF. Please try again.'
      );
    } finally {
      setSharingTransactionId(null);
    }
  };

  const handleSyncPayment = async (transaction: VTUHistoryTransaction) => {
    if (syncingTransactionId) {
      Alert.alert(
        'Sync In Progress',
        'Another payment sync is already running.'
      );
      return;
    }

    if (!transaction.payment_gateway || !transaction.payment_reference) {
      Alert.alert(
        'Cannot Sync',
        'Cannot sync: missing payment information.'
      );
      return;
    }

    setSyncingTransactionId(transaction.id);
    try {
      const result = await confirmVtuCheckout({
        gateway: transaction.payment_gateway,
        reference: transaction.payment_reference,
      });
      await refetch();

      Alert.alert(
        result.status === 'successful' ? 'Payment Synced' : 'Still Processing',
        result.status === 'successful'
          ? 'This utility payment has been reconciled.'
          : 'The payment is confirmed, but utility fulfillment is still processing.'
      );
    } catch (syncError) {
      console.error('Failed to sync VTU payment:', syncError);
      void refetch().catch((refetchError: unknown) => {
        console.error(
          'Failed to refetch VTU history after sync failure:',
          refetchError
        );
      });
      Alert.alert(
        'Sync Failed',
        getFriendlySyncErrorMessage(syncError)
      );
    } finally {
      setSyncingTransactionId(null);
    }
  };

  return {
    handleCopyVoucher,
    handleRepeatTransaction,
    handleShareReceipt,
    handleSyncPayment,
    sharingTransactionId,
    syncingTransactionId,
  };
}
