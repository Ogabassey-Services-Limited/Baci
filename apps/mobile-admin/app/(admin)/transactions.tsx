import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CostPriceEditorModal } from '@/components/transactions/CostPriceEditorModal';
import { TransactionOrderCard } from '@/components/transactions/TransactionOrderCard';
import { TransactionsSummary } from '@/components/transactions/TransactionsSummary';
import { styles } from '@/components/transactions/transactions.styles';
import { useCurrency } from '@/hooks/useCurrency';
import { useTheme } from '@/hooks/useTheme';
import {
  type TransactionReviewItem,
  useTransactionReview,
} from '@/hooks/useTransactionReview';
import { useUpdateTransactionCostPrice } from '@/hooks/useUpdateTransactionCostPrice';

export default function TransactionsScreen() {
  const { colors, isDark } = useTheme();
  const { format: formatCurrency } = useCurrency();
  const params = useLocalSearchParams<{
    endDate?: string | string[];
    startDate?: string | string[];
  }>();
  const startDateParam = Array.isArray(params.startDate)
    ? params.startDate[0]
    : params.startDate;
  const endDateParam = Array.isArray(params.endDate)
    ? params.endDate[0]
    : params.endDate;
  const parsedStartDate = startDateParam ? new Date(startDateParam) : undefined;
  const parsedEndDate = endDateParam ? new Date(endDateParam) : undefined;
  const range =
    parsedStartDate &&
    parsedEndDate &&
    !Number.isNaN(parsedStartDate.getTime()) &&
    !Number.isNaN(parsedEndDate.getTime()) &&
    parsedStartDate.getTime() <= parsedEndDate.getTime()
      ? {
          endDate: parsedEndDate,
          startDate: parsedStartDate,
        }
      : undefined;
  const {
    data: orders = [],
    isLoading,
    isRefetching,
    error,
    refetch,
  } = useTransactionReview(range);
  const isRetrying = isLoading || isRefetching;
  const updateCostPrice = useUpdateTransactionCostPrice();
  const [selectedItem, setSelectedItem] =
    useState<TransactionReviewItem | null>(null);
  const [costPriceInput, setCostPriceInput] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  const summary = orders.reduce(
    (acc, order) => ({
      estimatedProfit: acc.estimatedProfit + order.estimatedProfit,
      missingCosts: acc.missingCosts + order.missingCostCount,
      transactions: acc.transactions + 1,
    }),
    { estimatedProfit: 0, missingCosts: 0, transactions: 0 }
  );

  const handleOpenEditor = (item: TransactionReviewItem) => {
    if (!item.productId) {
      return;
    }
    setSelectedItem(item);
    setCostPriceInput(item.costPrice == null ? '' : String(item.costPrice));
    setSaveError(null);
  };

  const handleCloseEditor = () => {
    setSelectedItem(null);
    setCostPriceInput('');
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!selectedItem || selectedItem.productId == null) {
      return;
    }

    const nextCostPrice = Number.parseFloat(costPriceInput);
    if (Number.isNaN(nextCostPrice) || nextCostPrice < 0) {
      setSaveError('Enter a valid cost price (0 or greater).');
      return;
    }

    try {
      setSaveError(null);
      await updateCostPrice.mutateAsync({
        costPrice: nextCostPrice,
        productId: selectedItem.productId,
      });
      handleCloseEditor();
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : 'Could not update cost price. Please try again.'
      );
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Transactions',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      />
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <SystemBars style={isDark ? 'light' : 'dark'} />

        <ScrollView contentContainerStyle={styles.content}>
          <TransactionsSummary
            colors={colors}
            estimatedProfitLabel={formatCurrency(summary.estimatedProfit)}
            summary={summary}
          />

          {isLoading && orders.length === 0 ? (
            <View style={styles.stateContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : error && orders.length === 0 ? (
            <View style={styles.stateContainer}>
              <Ionicons
                name="alert-circle-outline"
                size={32}
                color={colors.error}
              />
              <Text style={[styles.stateText, { color: colors.textSecondary }]}>
                Unable to load transactions.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry loading transactions"
                disabled={isRetrying}
                onPress={() => {
                  void refetch();
                }}
                style={({ pressed }) => [
                  styles.actionButton,
                  {
                    backgroundColor: colors.primary,
                    opacity: isRetrying ? 0.6 : pressed ? 0.7 : 1,
                  },
                ]}
              >
                {isRetrying ? (
                  <ActivityIndicator color={colors.textOnPrimary} />
                ) : (
                  <Text
                    style={[
                      styles.actionButtonText,
                      { color: colors.textOnPrimary },
                    ]}
                  >
                    Try again
                  </Text>
                )}
              </Pressable>
            </View>
          ) : orders.length === 0 ? (
            <View style={styles.stateContainer}>
              <Ionicons
                name="receipt-outline"
                size={32}
                color={colors.textMuted}
              />
              <Text style={[styles.stateText, { color: colors.textSecondary }]}>
                No transactions yet.
              </Text>
            </View>
          ) : null}

          {error && orders.length > 0 ? (
            <View
              style={[
                styles.heroCard,
                {
                  backgroundColor: `${colors.warning}12`,
                  borderColor: `${colors.warning}30`,
                },
              ]}
            >
              <Text
                style={[styles.heroSubtitle, { color: colors.textSecondary }]}
              >
                Unable to refresh transactions. Showing the last loaded data.
              </Text>
            </View>
          ) : null}

          {orders.map((order) => (
            <TransactionOrderCard
              key={order.id}
              colors={colors}
              formatCurrency={formatCurrency}
              onOpenEditor={handleOpenEditor}
              order={order}
            />
          ))}
        </ScrollView>

        <CostPriceEditorModal
          colors={colors}
          costPriceInput={costPriceInput}
          onChangeCostPrice={setCostPriceInput}
          onClose={handleCloseEditor}
          onSave={handleSave}
          pending={updateCostPrice.isPending}
          saveError={saveError}
          selectedItem={selectedItem}
          visible={Boolean(selectedItem)}
        />
      </SafeAreaView>
    </>
  );
}
