/**
 * Receipts & Invoices Screen
 * Displays customer's payment records with receipt/invoice preview
 * Follows the orders/index.tsx pattern: auth guard, offline support, search
 */

import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useQueryClient } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { OfflineEmptyState, OfflineNotice } from '@/components/OfflineNotice';
import {
  getPaymentConfig,
  ReceiptCard,
} from '@/components/receipts/ReceiptCard';
import { ReceiptPreviewModal } from '@/components/receipts/ReceiptPreviewModal';
import { ReceiptsEmptyState } from '@/components/receipts/ReceiptsEmptyState';
import { ReceiptsSearchSection } from '@/components/receipts/ReceiptsSearchSection';
import { StorefrontScreenShell } from '@/components/storefront/StorefrontScreenShell';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import { useRequireAuth } from '@/hooks/use-auth-guard';
import { useNetworkState } from '@/hooks/use-network-state';
import { useReceiptPreview } from '@/hooks/use-receipt-preview';
import { receiptDetailQueryOptions, useReceipts } from '@/hooks/use-receipts';
import { useStorefrontInsets } from '@/hooks/use-storefront-insets';
import { RECEIPTS_SCREEN_STYLE_TOKENS } from './receipts-screen.constants';

export default function ReceiptsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const queryClient = useQueryClient();
  const { getListContentStyle } = useStorefrontInsets();

  const { redirectTo, user, isLoading: isAuthLoading } = useRequireAuth();
  const { isOnline } = useNetworkState();
  const { data: receipts, isLoading, error, refetch } = useReceipts(user?.id);
  const preview = useReceiptPreview();
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const hasReceipts = (receipts ?? []).length > 0;
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

  const handlePrefetch = (orderId: string) => {
    queryClient.prefetchQuery(receiptDetailQueryOptions(orderId));
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  if (redirectTo) {
    return <Redirect href={redirectTo} />;
  }

  if (isAuthLoading || isLoading) {
    return (
      <StorefrontScreenShell
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <View style={[styles.container, styles.centered]}>
          <ActivityIndicator size="large" color={BRAND.primary} />
        </View>
      </StorefrontScreenShell>
    );
  }

  if (error) {
    if (!isOnline) {
      return (
        <StorefrontScreenShell
          style={[styles.container, { backgroundColor: colors.background }]}
          edges={['bottom']}
        >
          <View style={[styles.container, styles.centered]}>
            <OfflineEmptyState
              title="Receipts Unavailable"
              description="Connect to the internet to view your receipts"
              onRetry={() => refetch()}
              isRetrying={isRefreshing}
            />
          </View>
        </StorefrontScreenShell>
      );
    }

    return (
      <StorefrontScreenShell
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <View style={[styles.container, styles.centered]}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={colors.textSecondary}
          />
          <Text style={[styles.errorText, { color: colors.text }]}>
            Failed to load receipts
          </Text>
          <TouchableOpacity
            onPress={() => refetch()}
            accessibilityRole="button"
            accessibilityLabel="Retry loading receipts"
            accessibilityHint="Retries loading your receipts"
          >
            <Text style={[styles.retryText, { color: BRAND.primary }]}>
              Tap to retry
            </Text>
          </TouchableOpacity>
        </View>
      </StorefrontScreenShell>
    );
  }

  return (
    <StorefrontScreenShell
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['bottom']}
    >
      {!isOnline && hasReceipts && (
        <OfflineNotice
          variant="banner"
          showCachedDataNotice
          showRetry
          onRetry={() => refetch()}
          isRetrying={isRefreshing}
        />
      )}

      {preview.isLoading && (
        <View
          style={[styles.generatingBanner, { backgroundColor: colors.card }]}
        >
          <ActivityIndicator size="small" color={BRAND.primary} />
          <Text
            style={[styles.generatingText, { color: colors.textSecondary }]}
          >
            Loading receipt...
          </Text>
        </View>
      )}

      <ReceiptsSearchSection
        colors={colors}
        filteredCount={filteredReceipts.length}
        hasReceipts={hasReceipts}
        onChangeSearchQuery={setSearchQuery}
        onClearSearch={() => setSearchQuery('')}
        searchQuery={searchQuery}
      />

      <FlashList
        data={filteredReceipts}
        renderItem={({ item }) => (
          <ReceiptCard
            item={item}
            colors={colors}
            onPress={preview.openPreview}
            onPrefetch={handlePrefetch}
          />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          getListContentStyle({ includeBottomInset: false }),
          filteredReceipts.length === 0 && styles.emptyListContent,
        ]}
        ListEmptyComponent={
          <ReceiptsEmptyState
            hasReceipts={hasReceipts}
            hasSearchQuery={
              filteredReceipts.length === 0 && searchQuery.length > 0
            }
            colors={colors}
            onClearSearch={() => setSearchQuery('')}
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={BRAND.primary}
            colors={[BRAND.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />

      <ReceiptPreviewModal
        visible={preview.isOpen}
        html={preview.html}
        onClose={preview.closePreview}
        isPaid={preview.isPaid}
      />
    </StorefrontScreenShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyListContent: {
    flex: 1,
  },
  errorText: {
    fontSize: RECEIPTS_SCREEN_STYLE_TOKENS.errorTextSize,
    marginTop: RECEIPTS_SCREEN_STYLE_TOKENS.errorTextMarginTop,
  },
  retryText: {
    fontSize: RECEIPTS_SCREEN_STYLE_TOKENS.retryTextSize,
    fontWeight: '600',
    marginTop: RECEIPTS_SCREEN_STYLE_TOKENS.retryTextMarginTop,
  },
  generatingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: RECEIPTS_SCREEN_STYLE_TOKENS.generatingBannerGap,
    paddingVertical:
      RECEIPTS_SCREEN_STYLE_TOKENS.generatingBannerPaddingVertical,
  },
  generatingText: {
    fontSize: RECEIPTS_SCREEN_STYLE_TOKENS.generatingTextSize,
  },
});
