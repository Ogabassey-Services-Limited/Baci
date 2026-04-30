import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  View,
} from 'react-native';
import { StorefrontScreenShell } from '@/components/storefront/StorefrontScreenShell';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, SPACING } from '@/constants/Colors';
import { useRequireAuth } from '@/hooks/use-auth-guard';
import { useStorefrontInsets } from '@/hooks/use-storefront-insets';
import {
  type UtilityHistoryFilter,
  type VTUHistoryTransaction,
  useVTUHistory,
} from '@/hooks/use-vtu-history';
import { utilityHistoryHelpers } from './history.helpers';
import { styles } from './history.styles';
import UtilityHistoryEmptyState from './UtilityHistoryEmptyState';
import UtilityHistoryFilters from './UtilityHistoryFilters';
import UtilityTransactionCard from './UtilityTransactionCard';
import { useUtilityHistoryActions } from './use-utility-history-actions';

export default function UtilityHistoryScreen() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { getScrollContentStyle } = useStorefrontInsets();
  const { isLoading: authLoading, redirectTo } = useRequireAuth();
  const [selectedFilter, setSelectedFilter] = useState<UtilityHistoryFilter>(
    utilityHistoryHelpers.resolveFilter(type)
  );
  const {
    data: transactions,
    error,
    isLoading,
    isRefetching,
    refetch,
  } = useVTUHistory(selectedFilter, 30);
  const {
    handleCopyVoucher,
    handleRepeatTransaction,
    handleShareReceipt,
    handleSyncPayment,
    sharingTransactionId,
    syncingTransactionId,
  } = useUtilityHistoryActions({ refetch });

  useEffect(() => {
    setSelectedFilter(utilityHistoryHelpers.resolveFilter(type));
  }, [type]);

  if (authLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Utility History' }} />
        <StorefrontScreenShell
          style={[styles.container, { backgroundColor: colors.background }]}
          edges={['bottom']}
        >
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={BRAND.primary} />
          </View>
        </StorefrontScreenShell>
      </>
    );
  }

  if (redirectTo) {
    return <Redirect href={redirectTo} />;
  }

  const scrollContentStyle = getScrollContentStyle({
    includeBottomInset: false,
    paddingBottom: SPACING.md,
    paddingTop: SPACING.md,
  });

  return (
    <>
      <Stack.Screen options={{ title: 'Utility History' }} />
      <StorefrontScreenShell
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <FlatList<VTUHistoryTransaction>
          data={transactions ?? []}
          renderItem={({ item }) => (
            <UtilityTransactionCard
              colors={colors}
              handleCopyVoucher={handleCopyVoucher}
              handleRepeatTransaction={handleRepeatTransaction}
              handleShareReceipt={handleShareReceipt}
              handleSyncPayment={handleSyncPayment}
              sharingTransactionId={sharingTransactionId}
              syncingTransactionId={syncingTransactionId}
              transaction={item}
            />
          )}
          keyExtractor={(transaction) => transaction.id}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={BRAND.primary}
            />
          }
          contentContainerStyle={[styles.content, scrollContentStyle]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <UtilityHistoryFilters
              colors={colors}
              selectedFilter={selectedFilter}
              setSelectedFilter={setSelectedFilter}
            />
          }
          ListEmptyComponent={
            <UtilityHistoryEmptyState
              colors={colors}
              error={error}
              isLoading={isLoading}
              refetch={refetch}
            />
          }
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
        />
      </StorefrontScreenShell>
    </>
  );
}
