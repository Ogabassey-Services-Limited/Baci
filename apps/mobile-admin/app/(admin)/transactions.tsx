import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CostPriceEditorModal } from '@/components/transactions/CostPriceEditorModal';
import { TransactionListState } from '@/components/transactions/TransactionListState';
import { TransactionOrderCard } from '@/components/transactions/TransactionOrderCard';
import { TransactionsSummary } from '@/components/transactions/TransactionsSummary';
import { styles } from '@/components/transactions/transactions.styles';
import { useCurrency } from '@/hooks/useCurrency';
import { useTheme } from '@/hooks/useTheme';
import {
  type TransactionReviewItem,
  type TransactionReviewOrder,
  useTransactionReview,
} from '@/hooks/useTransactionReview';
import { useUpdateTransactionCostPrice } from '@/hooks/useUpdateTransactionCostPrice';
import {
  buildTransactionDateIso,
  filterTransactionOrders,
  formatTransactionDateInput,
} from '@/lib/transaction-review';

type TransactionReviewTab = 'missing-costs' | 'paid';

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
  const [selectedOrder, setSelectedOrder] =
    useState<TransactionReviewOrder | null>(null);
  const [activeTab, setActiveTab] = useState<TransactionReviewTab>('paid');
  const [costPriceInput, setCostPriceInput] = useState('');
  const [dateInput, setDateInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [supplierInput, setSupplierInput] = useState('');

  const summary = orders.reduce(
    (acc, order) => ({
      estimatedProfit: acc.estimatedProfit + order.estimatedProfit,
      missingCosts: acc.missingCosts + order.missingCostCount,
      transactions: acc.transactions + 1,
    }),
    { estimatedProfit: 0, missingCosts: 0, transactions: 0 }
  );

  const searchedOrders = filterTransactionOrders(orders, searchQuery);
  const visibleOrders =
    activeTab === 'missing-costs'
      ? searchedOrders.filter((order) => order.missingCostCount > 0)
      : searchedOrders;

  const handleOpenEditor = (
    order: TransactionReviewOrder,
    item: TransactionReviewItem
  ) => {
    if (!item.productId) {
      return;
    }
    setSelectedOrder(order);
    setSelectedItem(item);
    setCostPriceInput(item.costPrice == null ? '' : String(item.costPrice));
    setDateInput(formatTransactionDateInput(order.createdAt));
    setSupplierInput(item.supplierName ?? '');
    setSaveError(null);
  };

  const handleCloseEditor = () => {
    setSelectedOrder(null);
    setSelectedItem(null);
    setCostPriceInput('');
    setDateInput('');
    setSaveError(null);
    setSupplierInput('');
  };

  const handleSave = async () => {
    if (!selectedOrder || !selectedItem || selectedItem.productId == null) {
      return;
    }

    const nextCostPrice = Number.parseFloat(costPriceInput);
    if (Number.isNaN(nextCostPrice) || nextCostPrice < 0) {
      setSaveError('Enter a valid cost price (0 or greater).');
      return;
    }

    const nextTransactionDateIso = buildTransactionDateIso(
      dateInput,
      selectedOrder.createdAt
    );
    if (!nextTransactionDateIso) {
      setSaveError('Enter a valid transaction date in YYYY-MM-DD format.');
      return;
    }

    try {
      setSaveError(null);
      await updateCostPrice.mutateAsync({
        costPrice: nextCostPrice,
        orderId: selectedOrder.id,
        productId: selectedItem.productId,
        productMetadata: selectedItem.productMetadata,
        supplierName: supplierInput,
        transactionDateIso: nextTransactionDateIso,
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
            activeTab={activeTab}
            colors={colors}
            estimatedProfitLabel={formatCurrency(summary.estimatedProfit)}
            onTabChange={setActiveTab}
            summary={summary}
          />

          <View
            style={[
              styles.searchContainer,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Ionicons
              name="search-outline"
              size={18}
              color={colors.textMuted}
            />
            <TextInput
              accessibilityLabel="Search transactions"
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setSearchQuery}
              placeholder="Search IMEI, serial, customer, order, supplier"
              placeholderTextColor={colors.textMuted}
              returnKeyType="search"
              style={[styles.searchInput, { color: colors.text }]}
              value={searchQuery}
            />
            {searchQuery ? (
              <Pressable
                accessibilityLabel="Clear transaction search"
                accessibilityRole="button"
                onPress={() => setSearchQuery('')}
                hitSlop={8}
              >
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={colors.textMuted}
                />
              </Pressable>
            ) : null}
          </View>

          <TransactionListState
            colors={colors}
            error={error}
            hasOrders={orders.length > 0}
            isLoading={isLoading}
            isRetrying={isRetrying}
            onRetry={() => {
              void refetch();
            }}
            visibleOrderCount={visibleOrders.length}
          />

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

          {visibleOrders.map((order) => (
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
          dateInput={dateInput}
          onChangeCostPrice={setCostPriceInput}
          onChangeDate={setDateInput}
          onChangeSupplier={setSupplierInput}
          onClose={handleCloseEditor}
          onSave={handleSave}
          pending={updateCostPrice.isPending}
          saveError={saveError}
          selectedItem={selectedItem}
          supplierInput={supplierInput}
          visible={Boolean(selectedItem)}
        />
      </SafeAreaView>
    </>
  );
}
