import Ionicons from '@react-native-vector-icons/ionicons';
import { FlashList } from '@shopify/flash-list';
import {
  ActivityIndicator,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { OfflineEmptyState, OfflineNotice } from '@/components/OfflineNotice';
import type Colors from '@/constants/Colors';
import type { ReceiptListItem } from '@/types/receipt';
import { ReceiptCard } from './ReceiptCard';
import { ReceiptPreviewModal } from './ReceiptPreviewModal';
import { ReceiptsEmptyState } from './ReceiptsEmptyState';
import { styles } from './receipt-screen.styles';

type ReceiptColors = (typeof Colors)['light'];

interface ReceiptsViewProps {
  colors: ReceiptColors;
  filteredReceipts: ReceiptListItem[];
  hasError: boolean;
  hasReceipts: boolean;
  isLoading: boolean;
  isOnline: boolean;
  isPreviewLoading: boolean;
  isPreviewOpen: boolean;
  isReceiptPaid: boolean;
  isRefreshing: boolean;
  onChangeSearch: (value: string) => void;
  onClearSearch: () => void;
  onClosePreview: () => void;
  onOpenPreview: (receipt: ReceiptListItem) => void;
  onPrefetch: (orderId: string) => void;
  onRefresh: () => void;
  onRetry: () => void;
  previewHtml: string;
  searchQuery: string;
}

export function ReceiptsView({
  colors,
  filteredReceipts,
  hasError,
  hasReceipts,
  isLoading,
  isOnline,
  isPreviewLoading,
  isPreviewOpen,
  isReceiptPaid,
  isRefreshing,
  onChangeSearch,
  onClearSearch,
  onClosePreview,
  onOpenPreview,
  onPrefetch,
  onRefresh,
  onRetry,
  previewHtml,
  searchQuery,
}: ReceiptsViewProps) {
  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator
          accessibilityLabel="Loading receipts"
          size="large"
          color={colors.tint}
        />
      </View>
    );
  }

  if (hasError) {
    if (!isOnline) {
      return (
        <View style={[styles.container, styles.centered]}>
          <OfflineEmptyState
            title="Receipts Unavailable"
            description="Connect to the internet to view your receipts"
            onRetry={onRetry}
            isRetrying={isRefreshing}
          />
        </View>
      );
    }

    return (
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
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry loading receipts"
          accessibilityHint="Retries loading your receipts"
        >
          <Text style={[styles.retryText, { color: colors.tint }]}>
            Tap to retry
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!isOnline && hasReceipts ? (
        <OfflineNotice
          variant="banner"
          showCachedDataNotice
          showRetry
          onRetry={onRetry}
          isRetrying={isRefreshing}
        />
      ) : null}

      {isPreviewLoading ? (
        <View
          style={[styles.generatingBanner, { backgroundColor: colors.card }]}
        >
          <ActivityIndicator size="small" color={colors.tint} />
          <Text
            style={[styles.generatingText, { color: colors.textSecondary }]}
          >
            Loading receipt…
          </Text>
        </View>
      ) : null}

      {hasReceipts ? (
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
              accessibilityLabel="Search receipts"
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search by order #, product, or status..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={onChangeSearch}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchQuery.length > 0 ? (
              <TouchableOpacity
                onPress={onClearSearch}
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
            ) : null}
          </View>
          {searchQuery.length > 0 ? (
            <Text
              style={[styles.searchResults, { color: colors.textSecondary }]}
            >
              {filteredReceipts.length}{' '}
              {filteredReceipts.length === 1 ? 'receipt' : 'receipts'} found
            </Text>
          ) : null}
        </View>
      ) : null}

      <FlashList
        data={filteredReceipts}
        renderItem={({ item }) => (
          <ReceiptCard
            item={item}
            colors={colors}
            onPress={onOpenPreview}
            onPrefetch={onPrefetch}
          />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          !hasReceipts && styles.emptyListContent,
        ]}
        ListEmptyComponent={
          <ReceiptsEmptyState
            hasReceipts={hasReceipts}
            hasSearchQuery={
              filteredReceipts.length === 0 && searchQuery.length > 0
            }
            colors={colors}
            onClearSearch={onClearSearch}
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.tint}
            colors={[colors.tint]}
          />
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />

      <ReceiptPreviewModal
        visible={isPreviewOpen}
        html={previewHtml}
        onClose={onClosePreview}
        isPaid={isReceiptPaid}
      />
    </View>
  );
}
