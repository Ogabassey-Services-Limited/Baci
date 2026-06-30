/**
 * Receipts & Invoices Screen
 * Displays customer's payment records with receipt/invoice preview
 * Follows the orders/index.tsx pattern: auth guard, offline support, search
 */
import { useQueryClient } from '@tanstack/react-query';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { getPaymentConfig } from '@/components/receipts/ReceiptCard';
import { ReceiptsTabs } from '@/components/receipts/ReceiptsTabs';
import { ReceiptsView } from '@/components/receipts/ReceiptsView';
import { StorefrontScreenShell } from '@/components/storefront/StorefrontScreenShell';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useRequireAuth } from '@/hooks/use-auth-guard';
import { useNetworkState } from '@/hooks/use-network-state';
import { useReceiptPreview } from '@/hooks/use-receipt-preview';
import { receiptDetailQueryOptions, useReceipts } from '@/hooks/use-receipts';

function readSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function ReceiptsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const queryClient = useQueryClient();

  // Auth guard
  const { redirectTo, user, isLoading: isAuthLoading } = useRequireAuth();
  const { receiptClaimed } = useLocalSearchParams<{
    receiptClaimed?: string | string[];
  }>();
  const { isOnline } = useNetworkState();
  const shouldShowClaimPrompt = readSingleParam(receiptClaimed) === '1';
  const claimPromptShown = useRef(false);

  // Data
  const { data: receipts, isLoading, error, refetch } = useReceipts(user?.id);

  // Receipt preview state machine (idle → loading → open → idle)
  const preview = useReceiptPreview();

  // Prefetch receipt detail when user's finger touches a card (before onPress fires)
  const handlePrefetch = (orderId: string) => {
    queryClient.prefetchQuery(receiptDetailQueryOptions(orderId));
  };

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (
      isAuthLoading ||
      redirectTo ||
      !shouldShowClaimPrompt ||
      claimPromptShown.current
    ) {
      return;
    }

    claimPromptShown.current = true;
    Alert.alert(
      'Receipts ready',
      'Your imported receipts are now available in Ogabassey.',
      [
        {
          text: 'View receipts',
          onPress: () => router.replace('/receipts'),
        },
      ],
      { cancelable: false }
    );
  }, [isAuthLoading, redirectTo, shouldShowClaimPrompt]);

  // Declarative auth-gate
  if (redirectTo) {
    return <Redirect href={redirectTo} />;
  }

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  // Filter receipts by search query
  const filteredReceipts = (receipts ?? []).filter((receipt) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();

    const orderMatch = receipt.order_number?.toLowerCase().includes(query);
    const statusConfig = getPaymentConfig(receipt.payment_status);
    const statusMatch = statusConfig.label.toLowerCase().includes(query);
    const itemMatch = receipt.items?.some((item) =>
      item.product_name?.toLowerCase().includes(query)
    );

    return orderMatch || statusMatch || itemMatch;
  });

  return (
    <StorefrontScreenShell
      edges={['bottom']}
      style={{ backgroundColor: colors.background }}
    >
      <ReceiptsTabs
        colors={colors}
        devicesContent={
          <ReceiptsView
            colors={colors}
            filteredReceipts={filteredReceipts}
            hasError={Boolean(error)}
            hasReceipts={(receipts ?? []).length > 0}
            isLoading={isAuthLoading || isLoading}
            isOnline={isOnline}
            isPreviewLoading={preview.isLoading}
            isPreviewOpen={preview.isOpen}
            isReceiptPaid={preview.isPaid}
            isRefreshing={isRefreshing}
            onChangeSearch={setSearchQuery}
            onClearSearch={() => setSearchQuery('')}
            onClosePreview={preview.closePreview}
            onOpenPreview={preview.openPreview}
            onPrefetch={handlePrefetch}
            onRefresh={handleRefresh}
            onRetry={() => {
              void refetch();
            }}
            previewHtml={preview.html}
            searchQuery={searchQuery}
          />
        }
      />
    </StorefrontScreenShell>
  );
}
