import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import { useRequireAuth } from '@/hooks/use-auth-guard';
import {
  type UtilityHistoryFilter,
  type VTUHistoryTransaction,
  useVTUHistory,
} from '@/hooks/use-vtu-history';

const HISTORY_FILTERS: Array<{
  id: UtilityHistoryFilter;
  label: string;
}> = [
  { id: 'all', label: 'All' },
  { id: 'airtime', label: 'Airtime' },
  { id: 'data', label: 'Data' },
  { id: 'power', label: 'Power' },
  { id: 'tv', label: 'TV' },
  { id: 'gaming', label: 'Gaming' },
];

const TYPE_LABELS: Record<VTUHistoryTransaction['type'], string> = {
  airtime: 'Airtime',
  data: 'Data',
  electricity: 'Power',
  cable_tv: 'TV',
  betting: 'Gaming',
};

function resolveInitialFilter(type?: string): UtilityHistoryFilter {
  return HISTORY_FILTERS.some((filter) => filter.id === type)
    ? (type as UtilityHistoryFilter)
    : 'all';
}

function formatAmount(amount: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getTransactionTitle(transaction: VTUHistoryTransaction) {
  return (
    transaction.biller_name ||
    transaction.network_provider ||
    TYPE_LABELS[transaction.type]
  );
}

function getTransactionDetail(transaction: VTUHistoryTransaction) {
  if (transaction.type === 'airtime' || transaction.type === 'data') {
    return transaction.phone_number || 'Phone number unavailable';
  }

  return (
    transaction.customer_identifier ||
    transaction.customer_name ||
    'Customer identifier unavailable'
  );
}

export default function UtilityHistoryScreen() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { isLoading: authLoading, redirectTo } = useRequireAuth();
  const [selectedFilter, setSelectedFilter] = useState<UtilityHistoryFilter>(
    resolveInitialFilter(type)
  );
  const {
    data: transactions,
    error,
    isLoading,
    isRefetching,
    refetch,
  } = useVTUHistory(selectedFilter, 30);

  useEffect(() => {
    setSelectedFilter(resolveInitialFilter(type));
  }, [type]);

  if (authLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Utility History' }} />
        <View
          style={[
            styles.centered,
            styles.container,
            { backgroundColor: colors.background },
          ]}
        >
          <ActivityIndicator size="large" color={BRAND.primary} />
        </View>
      </>
    );
  }

  if (redirectTo) {
    return <Redirect href={redirectTo} />;
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Utility History' }} />
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => refetch()}
              tintColor={BRAND.primary}
            />
          }
          contentContainerStyle={styles.content}
        >
          <View style={styles.filterRow}>
            {HISTORY_FILTERS.map((filter) => {
              const isSelected = filter.id === selectedFilter;

              return (
                <Pressable
                  key={filter.id}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: isSelected ? BRAND.primary : colors.card,
                      borderColor: isSelected ? BRAND.primary : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedFilter(filter.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Show ${filter.label.toLowerCase()} history`}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: isSelected ? '#FFF' : colors.text },
                    ]}
                  >
                    {filter.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={BRAND.primary} />
            </View>
          ) : error ? (
            <View style={[styles.stateCard, { borderColor: colors.border }]}>
              <Text style={[styles.stateTitle, { color: colors.text }]}>
                Unable to load history
              </Text>
              <Text
                style={[styles.stateMessage, { color: colors.textSecondary }]}
              >
                {error.message}
              </Text>
              <Pressable
                style={[
                  styles.retryButton,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
                onPress={() => refetch()}
              >
                <Text style={[styles.retryText, { color: colors.text }]}>
                  Try Again
                </Text>
              </Pressable>
            </View>
          ) : transactions && transactions.length > 0 ? (
            transactions.map((transaction) => {
              const statusColor =
                transaction.status === 'successful'
                  ? '#15803D'
                  : transaction.status === 'failed'
                    ? '#B91C1C'
                    : '#92400E';

              return (
                <View
                  key={transaction.id}
                  style={[
                    styles.transactionCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.transactionHeader}>
                    <View style={styles.transactionCopy}>
                      <Text
                        style={[styles.transactionTitle, { color: colors.text }]}
                        numberOfLines={2}
                      >
                        {getTransactionTitle(transaction)}
                      </Text>
                      <Text
                        style={[
                          styles.transactionDetail,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {TYPE_LABELS[transaction.type]} •{' '}
                        {getTransactionDetail(transaction)}
                      </Text>
                    </View>
                    <Text
                      style={[styles.transactionAmount, { color: colors.text }]}
                    >
                      {formatAmount(transaction.amount)}
                    </Text>
                  </View>

                  <View style={styles.metaRow}>
                    <Text
                      style={[styles.metaText, { color: colors.textSecondary }]}
                    >
                      {formatDate(transaction.created_at)}
                    </Text>
                    <View
                      style={[
                        styles.statusPill,
                        { backgroundColor: `${statusColor}18` },
                      ]}
                    >
                      <Text style={[styles.statusText, { color: statusColor }]}>
                        {transaction.status}
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={[styles.referenceText, { color: colors.textSecondary }]}
                  >
                    Ref: {transaction.request_reference}
                  </Text>

                  {transaction.customer_name ? (
                    <Text
                      style={[
                        styles.referenceText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Verified as {transaction.customer_name}
                    </Text>
                  ) : null}

                  {transaction.customer_cashback &&
                  transaction.customer_cashback > 0 ? (
                    <Text style={[styles.cashbackText, { color: '#15803D' }]}>
                      Cashback: {formatAmount(transaction.customer_cashback)}
                    </Text>
                  ) : null}

                  {transaction.error_message ? (
                    <Text style={[styles.errorText, { color: '#B91C1C' }]}>
                      {transaction.error_message}
                    </Text>
                  ) : null}
                </View>
              );
            })
          ) : (
            <View style={[styles.stateCard, { borderColor: colors.border }]}>
              <Text style={[styles.stateTitle, { color: colors.text }]}>
                No history yet
              </Text>
              <Text
                style={[styles.stateMessage, { color: colors.textSecondary }]}
              >
                Completed utility purchases will appear here once they are
                available for this account.
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: 16,
    gap: 12,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  transactionCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  transactionHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  transactionCopy: {
    flex: 1,
    gap: 4,
  },
  transactionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  transactionDetail: {
    fontSize: 13,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  referenceText: {
    fontSize: 12,
  },
  cashbackText: {
    fontSize: 12,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
  },
  stateCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    gap: 10,
    alignItems: 'flex-start',
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  stateMessage: {
    fontSize: 14,
    lineHeight: 20,
  },
  retryButton: {
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  retryText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
