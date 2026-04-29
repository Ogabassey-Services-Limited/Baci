import {
  Redirect,
  Stack,
  useLocalSearchParams,
} from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { StorefrontScreenShell } from '@/components/storefront/StorefrontScreenShell';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, SPACING } from '@/constants/Colors';
import { useRequireAuth } from '@/hooks/use-auth-guard';
import { useStorefrontInsets } from '@/hooks/use-storefront-insets';
import {
  type UtilityHistoryFilter,
  useVTUHistory,
} from '@/hooks/use-vtu-history';
import {
  UTILITY_HISTORY_FILTERS,
  UTILITY_HISTORY_STATUS_COLORS,
  UTILITY_HISTORY_STYLE_TOKENS,
  UTILITY_HISTORY_TYPE_LABELS,
} from './history.constants';
import { utilityHistoryHelpers } from './history.helpers';
import { styles } from './history.styles';
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

  const scrollContentStyle = getScrollContentStyle({
    includeBottomInset: false,
    paddingBottom: SPACING.md,
    paddingTop: SPACING.md,
  });

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

  return (
    <>
      <Stack.Screen options={{ title: 'Utility History' }} />
      <StorefrontScreenShell
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={BRAND.primary}
            />
          }
          contentContainerStyle={[styles.content, scrollContentStyle]}
          showsVerticalScrollIndicator={false}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
            style={styles.filterScroller}
          >
            {UTILITY_HISTORY_FILTERS.map((filter) => {
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
                      {
                        color: isSelected ? colors.white : colors.text,
                      },
                    ]}
                  >
                    {filter.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

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
                  styles.pillButtonBase,
                  styles.retryButton,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
                onPress={() => refetch()}
                accessibilityRole="button"
                accessibilityLabel="Retry loading utility history"
              >
                <Text style={[styles.retryText, { color: colors.text }]}>
                  Try Again
                </Text>
              </Pressable>
            </View>
          ) : transactions && transactions.length > 0 ? (
            transactions.map((transaction) => {
              const displayStatus =
                utilityHistoryHelpers.getDisplayStatus(transaction);
              const hasReceivedGatewayPayment =
                transaction.status !== 'successful' &&
                transaction.payment_status === 'completed';
              const voucherPin = transaction.voucher_pin;

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
                        style={[
                          styles.transactionTitle,
                          { color: colors.text },
                        ]}
                        numberOfLines={2}
                      >
                        {utilityHistoryHelpers.getTransactionTitle(transaction)}
                      </Text>
                      <Text
                        style={[
                          styles.transactionDetail,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {UTILITY_HISTORY_TYPE_LABELS[transaction.type]} •{' '}
                        {utilityHistoryHelpers.getTransactionDetail(
                          transaction
                        )}
                      </Text>
                    </View>
                    <Text
                      style={[styles.transactionAmount, { color: colors.text }]}
                    >
                      {utilityHistoryHelpers.formatAmount(transaction.amount)}
                    </Text>
                  </View>

                  <View style={styles.metaRow}>
                    <Text
                      style={[styles.metaText, { color: colors.textSecondary }]}
                    >
                      {utilityHistoryHelpers.formatDate(transaction.created_at)}
                    </Text>
                    <View
                      style={[
                        styles.statusPill,
                        {
                          backgroundColor: `${displayStatus.color}${UTILITY_HISTORY_STYLE_TOKENS.statusTintSuffix}`,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: displayStatus.color },
                        ]}
                      >
                        {displayStatus.label}
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={[
                      styles.referenceText,
                      { color: colors.textSecondary },
                    ]}
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

                  {displayStatus.message ? (
                    <Text
                      style={[
                        styles.paymentNoticeText,
                        { color: displayStatus.color },
                      ]}
                    >
                      {displayStatus.message}
                    </Text>
                  ) : null}

                  {voucherPin ? (
                    <View
                      style={[
                        styles.voucherBox,
                        {
                          backgroundColor: colors.muted,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.voucherLabel,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Voucher / Token
                      </Text>
                      <Text
                        selectable
                        style={[styles.voucherCode, { color: colors.text }]}
                      >
                        {voucherPin}
                      </Text>
                      <Pressable
                        style={[
                          styles.pillButtonBase,
                          styles.tokenButton,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                          },
                        ]}
                        onPress={() => handleCopyVoucher(voucherPin)}
                        accessibilityRole="button"
                        accessibilityLabel="Copy voucher token"
                      >
                        <Text
                          style={[
                            styles.tokenButtonText,
                            { color: BRAND.primary },
                          ]}
                        >
                          Copy token
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}

                  {transaction.customer_cashback &&
                  transaction.customer_cashback > 0 ? (
                    <Text
                      style={[
                        styles.cashbackText,
                        {
                          color: UTILITY_HISTORY_STATUS_COLORS.successful,
                        },
                      ]}
                    >
                      Cashback:{' '}
                      {utilityHistoryHelpers.formatAmount(
                        transaction.customer_cashback
                      )}
                    </Text>
                  ) : null}

                  {transaction.error_message ? (
                    <Text
                      style={[
                        styles.errorText,
                        { color: UTILITY_HISTORY_STATUS_COLORS.failed },
                      ]}
                    >
                      {transaction.error_message}
                    </Text>
                  ) : null}

                  <View style={styles.actionRow}>
                    {hasReceivedGatewayPayment ? null : (
                      <Pressable
                        style={[
                          styles.pillButtonBase,
                          styles.repeatButton,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                          },
                        ]}
                        onPress={() => handleRepeatTransaction(transaction)}
                        accessibilityRole="button"
                        accessibilityLabel={`Repeat ${utilityHistoryHelpers.getTransactionTitle(transaction)}`}
                      >
                        <Text
                          style={[styles.repeatText, { color: BRAND.primary }]}
                        >
                          Repeat
                        </Text>
                      </Pressable>
                    )}
                    {transaction.status === 'successful' ? (
                      <Pressable
                        style={[
                          styles.pillButtonBase,
                          styles.repeatButton,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                            opacity:
                              sharingTransactionId === transaction.id ? 0.6 : 1,
                          },
                        ]}
                        onPress={() => handleShareReceipt(transaction)}
                        disabled={sharingTransactionId === transaction.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Share receipt for ${utilityHistoryHelpers.getTransactionTitle(transaction)}`}
                      >
                        <Text
                          style={[styles.repeatText, { color: BRAND.primary }]}
                        >
                          {sharingTransactionId === transaction.id
                            ? 'Sharing...'
                            : 'Share receipt'}
                        </Text>
                      </Pressable>
                    ) : null}
                    {transaction.status !== 'successful' &&
                    transaction.payment_gateway &&
                    transaction.payment_reference ? (
                      <Pressable
                        style={[
                          styles.pillButtonBase,
                          styles.repeatButton,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                            opacity:
                              syncingTransactionId === transaction.id ? 0.6 : 1,
                          },
                        ]}
                        onPress={() => handleSyncPayment(transaction)}
                        disabled={syncingTransactionId === transaction.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Sync payment for ${utilityHistoryHelpers.getTransactionTitle(transaction)}`}
                      >
                        <Text
                          style={[styles.repeatText, { color: BRAND.primary }]}
                        >
                          {syncingTransactionId === transaction.id
                            ? 'Syncing...'
                            : 'Sync payment'}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
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
      </StorefrontScreenShell>
    </>
  );
}
