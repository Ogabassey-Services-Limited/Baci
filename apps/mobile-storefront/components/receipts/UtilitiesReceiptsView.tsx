import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type Colors from '@/constants/Colors';
import { BRAND, SPACING } from '@/constants/Colors';
import { useMerchantReceiptInfo } from '@/hooks/use-receipts';
import {
  useVTUHistory,
  type VTUHistoryTransaction,
} from '@/hooks/use-vtu-history';
import {
  buildReceiptMessage,
  buildUtilityReceiptHtml,
  type UtilityReceiptData,
} from '@/lib/utility-receipt';
import { utilityRepeatHelpers } from '@/lib/utility-repeat';
import { ReceiptPreviewModal } from './ReceiptPreviewModal';
import { UtilityReceiptCard } from './UtilityReceiptCard';

interface UtilitiesReceiptsViewProps {
  colors: typeof Colors.light;
}

function toReceiptData(
  transaction: VTUHistoryTransaction,
  merchant?: { business_name?: string | null; logo_url?: string | null }
): UtilityReceiptData {
  return {
    amount: transaction.amount,
    billerName: transaction.biller_name ?? undefined,
    cashback: transaction.customer_cashback,
    customerIdentifier:
      transaction.customer_identifier ?? transaction.phone_number ?? undefined,
    customerName: transaction.customer_name,
    dateTime: transaction.created_at,
    logoUrl: merchant?.logo_url,
    merchantName: merchant?.business_name,
    network: transaction.network_provider ?? undefined,
    phoneNumber: transaction.phone_number ?? undefined,
    reference: transaction.request_reference,
    status: transaction.status,
    token: transaction.voucher_pin,
    type: utilityRepeatHelpers.getRouteType(transaction.type),
  };
}

export function UtilitiesReceiptsView({ colors }: UtilitiesReceiptsViewProps) {
  const { data, isLoading, isError, refetch } = useVTUHistory('all', 50);
  const { data: merchantInfo } = useMerchantReceiptInfo();
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Keep the whole selected transaction so the preview can reflect its real
  // paid/failed/pending status (history includes non-successful rows).
  const [selected, setSelected] = useState<VTUHistoryTransaction | null>(null);

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
          Couldn't load your utility receipts.
        </Text>
        <TouchableOpacity
          onPress={handleRefresh}
          accessibilityRole="button"
          accessibilityLabel="Retry loading utility receipts"
          style={[styles.retryButton, { backgroundColor: BRAND.primary }]}
        >
          <Text style={styles.retryLabel}>
            {isRefreshing ? 'Retrying…' : 'Try again'}
          </Text>
        </TouchableOpacity>
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
            onView={setSelected}
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
        visible={selected !== null}
        html={
          selected
            ? buildUtilityReceiptHtml(toReceiptData(selected, merchantInfo))
            : ''
        }
        shareText={
          selected
            ? buildReceiptMessage(toReceiptData(selected, merchantInfo))
            : undefined
        }
        documentType="receipt"
        onClose={() => setSelected(null)}
        isPaid={selected?.status === 'successful'}
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
  retryButton: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: 999,
  },
  retryLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
