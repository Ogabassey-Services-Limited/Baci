import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type Colors from '@/constants/Colors';
import { BRAND, SPACING } from '@/constants/Colors';
import {
  useVTUHistory,
  type VTUHistoryTransaction,
} from '@/hooks/use-vtu-history';
import { buildUtilityReceiptHtml } from '@/lib/utility-receipt';
import { utilityRepeatHelpers } from '@/lib/utility-repeat';
import { ReceiptPreviewModal } from './ReceiptPreviewModal';
import { UtilityReceiptCard } from './UtilityReceiptCard';

interface UtilitiesReceiptsViewProps {
  colors: typeof Colors.light;
}

function toReceiptHtml(transaction: VTUHistoryTransaction): string {
  return buildUtilityReceiptHtml({
    amount: transaction.amount,
    billerName: transaction.biller_name ?? undefined,
    customerIdentifier:
      transaction.customer_identifier ?? transaction.phone_number ?? undefined,
    customerName: transaction.customer_name,
    dateTime: transaction.created_at,
    network: transaction.network_provider ?? undefined,
    phoneNumber: transaction.phone_number ?? undefined,
    reference: transaction.request_reference,
    status: transaction.status,
    token: transaction.voucher_pin,
    type: utilityRepeatHelpers.getRouteType(transaction.type),
  });
}

export function UtilitiesReceiptsView({ colors }: UtilitiesReceiptsViewProps) {
  const { data, isLoading, isError, refetch } = useVTUHistory('all', 50);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [receiptHtml, setReceiptHtml] = useState<string | null>(null);

  const transactions = data ?? [];

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator
          size="large"
          color={BRAND.primary}
          accessibilityLabel="Loading utility receipts"
        />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.muted, { color: colors.textSecondary }]}>
          Couldn't load your utility receipts. Pull to retry.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <UtilityReceiptCard
            transaction={item}
            colors={colors}
            onView={(transaction) => setReceiptHtml(toReceiptHtml(transaction))}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={BRAND.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={[styles.muted, { color: colors.textSecondary }]}>
              No utility receipts yet. Buy airtime, data, or pay a bill to see
              them here.
            </Text>
          </View>
        }
      />
      <ReceiptPreviewModal
        visible={receiptHtml !== null}
        html={receiptHtml ?? ''}
        onClose={() => setReceiptHtml(null)}
        isPaid
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
    flexGrow: 1,
  },
  separator: {
    height: SPACING.md,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  muted: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
