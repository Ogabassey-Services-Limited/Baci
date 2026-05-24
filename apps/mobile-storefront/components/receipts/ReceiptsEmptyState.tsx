import Ionicons from "@react-native-vector-icons/ionicons/static";
import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BRAND } from '@/constants/Colors';

interface ReceiptsEmptyStateProps {
  hasReceipts: boolean;
  hasSearchQuery: boolean;
  colors: { text: string; textSecondary: string };
  onClearSearch: () => void;
}

export function ReceiptsEmptyState({
  hasReceipts,
  hasSearchQuery,
  colors,
  onClearSearch,
}: ReceiptsEmptyStateProps) {
  if (hasReceipts && hasSearchQuery) {
    return (
      <View style={styles.emptyState}>
        <Ionicons
          name="search-outline"
          size={64}
          color={colors.textSecondary}
        />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          No matching receipts
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
          Try searching with a different term
        </Text>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: BRAND.primary }]}
          onPress={onClearSearch}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Clear Search"
          accessibilityHint="Clears the current search query to show all receipts"
        >
          <Text style={styles.actionBtnText}>Clear Search</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.emptyState}>
      <Ionicons
        name="document-text-outline"
        size={64}
        color={colors.textSecondary}
      />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        No receipts yet
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        When you make purchases, your receipts and invoices will appear here
      </Text>
      <TouchableOpacity
        style={[styles.actionBtn, { backgroundColor: BRAND.primary }]}
        onPress={() => router.push('/')}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Start Shopping"
        accessibilityHint="Navigates to the storefront home page to start shopping"
      >
        <Text style={styles.actionBtnText}>Start Shopping</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
  },
  actionBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 24,
  },
  actionBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
