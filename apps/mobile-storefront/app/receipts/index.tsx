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
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OfflineEmptyState, OfflineNotice } from '@/components/OfflineNotice';
import {
  getPaymentConfig,
  ReceiptCard,
} from '@/components/receipts/ReceiptCard';
import { ReceiptPreviewModal } from '@/components/receipts/ReceiptPreviewModal';
import { ReceiptsEmptyState } from '@/components/receipts/ReceiptsEmptyState';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import { useRequireAuth } from '@/hooks/use-auth-guard';
import { useNetworkState } from '@/hooks/use-network-state';
import { useReceiptPreview } from '@/hooks/use-receipt-preview';
import { receiptDetailQueryOptions, useReceipts } from '@/hooks/use-receipts';

export default function ReceiptsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const queryClient = useQueryClient();

  // Auth guard
  const { redirectTo, user, isLoading: isAuthLoading } = useRequireAuth();
  const { isOnline } = useNetworkState();

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

  if (isAuthLoading || isLoading) {
    return (
      <View
        style={[
          styles.container,
          styles.centered,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={BRAND.primary} />
      </View>
    );
  }

  if (error) {
    if (!isOnline) {
      return (
        <View
          style={[
            styles.container,
            styles.centered,
            { backgroundColor: colors.background },
          ]}
        >
          <OfflineEmptyState
            title="Receipts Unavailable"
            description="Connect to the internet to view your receipts"
            onRetry={() => refetch()}
            isRetrying={isRefreshing}
          />
        </View>
      );
    }

    return (
      <View
        style={[
          styles.container,
          styles.centered,
          { backgroundColor: colors.background },
        ]}
      >
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
    );
  }

  return (
    <SafeAreaView
      edges={['bottom']}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {!isOnline && (receipts ?? []).length > 0 && (
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

      {(receipts ?? []).length > 0 && (
        <View
          style={[
            styles.searchContainer,
            { backgroundColor: colors.background },
          ]}
        >
          <View
            style={[
              styles.searchInputContainer,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Ionicons
              name="search-outline"
              size={20}
              color={colors.textSecondary}
            />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search by order #, product, or status..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                accessibilityHint="Clears the current search query"
              >
                <Ionicons
                  name="close-circle"
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>
          {searchQuery.length > 0 && (
            <Text
              style={[styles.searchResults, { color: colors.textSecondary }]}
            >
              {filteredReceipts.length}{' '}
              {filteredReceipts.length === 1 ? 'receipt' : 'receipts'} found
            </Text>
          )}
        </View>
      )}

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
          styles.listContent,
          (receipts ?? []).length === 0 && styles.emptyListContent,
        ]}
        ListEmptyComponent={
          <ReceiptsEmptyState
            hasReceipts={(receipts ?? []).length > 0}
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
    </SafeAreaView>
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
  listContent: {
    padding: 16,
    gap: 12,
  },
  emptyListContent: {
    flex: 1,
  },
  errorText: {
    fontSize: 16,
    marginTop: 12,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  searchResults: {
    fontSize: 13,
    marginTop: 8,
    marginLeft: 4,
  },
  generatingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  generatingText: {
    fontSize: 14,
  },
});
