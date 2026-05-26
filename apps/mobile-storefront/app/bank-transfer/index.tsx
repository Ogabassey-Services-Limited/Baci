import Ionicons from "@react-native-vector-icons/ionicons";
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable } from 'react-native';
import { z } from 'zod';
import { BankTransferView } from '@/components/bank-transfer/BankTransferView';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { setClipboardString } from '@/lib/clipboard';
import { useCartStore } from '@/stores/cart-store';

const copyToClipboard = async (text: string) => {
  return await setClipboardString(text);
};

const BankTransferParamsSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  orderNumber: z.string().optional(),
  reference: z.string().min(1, 'Reference is required'),
  amount: z.string().min(1, 'Amount is required'),
  bankName: z.string().min(1, 'Bank name is required'),
  accountNumber: z.string().min(1, 'Account number is required'),
  accountName: z.string().min(1, 'Account name is required'),
  trackingToken: z.string().trim().optional(),
});

const HEADER_CLOSE_STYLE = { padding: 8 } as const;

export default function BankTransferScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const params = useLocalSearchParams<Record<string, string>>();
  const clearCart = useCartStore((state) => state.clearCart);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validatedParams = (() => {
    const result = BankTransferParamsSchema.safeParse(params);
    if (!result.success) {
      return {
        isValid: false,
        error: result.error.issues[0]?.message || 'Invalid parameters',
        data: null,
      };
    }
    return { isValid: true, error: null, data: result.data };
  })();

  const {
    orderId,
    orderNumber,
    reference,
    amount,
    bankName,
    accountNumber,
    accountName,
    trackingToken,
  } = validatedParams.data || {};

  const handleCopy = async (text: string, field: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } else {
      // Optional: show toast or alert if copy fails
    }
  };

  const handleConfirmTransfer = () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    clearCart();
    router.replace({
      pathname: '/order-success',
      params: {
        orderId,
        orderNumber: orderNumber || '',
        paymentMethod: 'bank_transfer',
        reference,
        ...(trackingToken && { trackingToken }),
      },
    });
  };

  const handleClose = () => {
    Alert.alert(
      'Leave Payment?',
      'Your order has been created. You can complete payment later using the account details sent to your email.',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => router.back(),
        },
      ]
    );
  };

  return (
    <>
      <Stack.Screen
        options={
          validatedParams.isValid
            ? {
                title: 'Bank Transfer',
                headerShown: true,
                headerLeft: () => (
                  <Pressable
                    accessibilityLabel="Close bank transfer"
                    accessibilityRole="button"
                    onPress={handleClose}
                    style={HEADER_CLOSE_STYLE}
                  >
                    <Ionicons name="close" size={24} color={colors.text} />
                  </Pressable>
                ),
              }
            : { headerShown: false }
        }
      />
      <BankTransferView
        accountName={accountName}
        accountNumber={accountNumber}
        amount={amount}
        bankName={bankName}
        colors={colors}
        copiedField={copiedField}
        error={validatedParams.error}
        isSubmitting={isSubmitting}
        isValid={validatedParams.isValid}
        onBack={() => router.back()}
        onConfirmTransfer={handleConfirmTransfer}
        onCopyAccountName={() => handleCopy(accountName || '', 'name')}
        onCopyAccountNumber={() => handleCopy(accountNumber || '', 'account')}
        onCopyBankName={() => handleCopy(bankName || '', 'bank')}
      />
    </>
  );
}
