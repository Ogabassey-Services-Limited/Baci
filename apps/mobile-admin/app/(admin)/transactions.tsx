import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useCurrency } from '@/hooks/useCurrency';
import { useTheme } from '@/hooks/useTheme';
import {
  type TransactionReviewItem,
  useTransactionReview,
  useUpdateTransactionCostPrice,
} from '@/hooks/useTransactionReview';

export default function TransactionsScreen() {
  const { colors, isDark } = useTheme();
  const { format: formatCurrency } = useCurrency();
  const { data: orders = [], isLoading, error } = useTransactionReview();
  const updateCostPrice = useUpdateTransactionCostPrice();
  const [selectedItem, setSelectedItem] =
    useState<TransactionReviewItem | null>(null);
  const [costPriceInput, setCostPriceInput] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  const summary = useMemo(() => {
    return orders.reduce(
      (acc, order) => ({
        estimatedProfit: acc.estimatedProfit + order.estimatedProfit,
        missingCosts: acc.missingCosts + order.missingCostCount,
        transactions: acc.transactions + 1,
      }),
      { estimatedProfit: 0, missingCosts: 0, transactions: 0 }
    );
  }, [orders]);

  const handleOpenEditor = (item: TransactionReviewItem) => {
    setSelectedItem(item);
    setCostPriceInput(item.costPrice > 0 ? String(item.costPrice) : '');
    setSaveError(null);
  };

  const handleCloseEditor = () => {
    setSelectedItem(null);
    setCostPriceInput('');
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!selectedItem?.productId) {
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
          <View style={styles.summaryRow}>
            <View
              style={[
                styles.summaryCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text
                style={[styles.summaryLabel, { color: colors.textSecondary }]}
              >
                Paid transactions
              </Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {summary.transactions}
              </Text>
            </View>
            <View
              style={[
                styles.summaryCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text
                style={[styles.summaryLabel, { color: colors.textSecondary }]}
              >
                Missing costs
              </Text>
              <Text style={[styles.summaryValue, { color: colors.error }]}>
                {summary.missingCosts}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.heroCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text
              style={[styles.summaryLabel, { color: colors.textSecondary }]}
            >
              Estimated profit
            </Text>
            <Text style={[styles.heroValue, { color: colors.text }]}>
              {formatCurrency(summary.estimatedProfit)}
            </Text>
            <Text style={[styles.heroSubtitle, { color: colors.textMuted }]}>
              Update product cost prices here so analytics profit stays grounded
              in actual margins.
            </Text>
          </View>

          {isLoading && orders.length === 0 ? (
            <View style={styles.stateContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : error ? (
            <View style={styles.stateContainer}>
              <Ionicons
                name="alert-circle-outline"
                size={32}
                color={colors.error}
              />
              <Text style={[styles.stateText, { color: colors.textSecondary }]}>
                Unable to load transactions. Please try again.
              </Text>
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

          {!error &&
            orders.map((order) => (
              <View
                key={order.id}
                style={[
                  styles.orderCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View style={styles.orderHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.orderTitle, { color: colors.text }]}>
                      {order.orderNumber}
                    </Text>
                    <Text
                      style={[
                        styles.orderSubtitle,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {order.customerName} · {order.paymentMethod}
                    </Text>
                  </View>
                  <View style={styles.orderMeta}>
                    <Text
                      style={[styles.orderAmount, { color: colors.primary }]}
                    >
                      {formatCurrency(order.total)}
                    </Text>
                    <Text
                      style={[
                        styles.orderSubtitle,
                        { color: colors.textMuted },
                      ]}
                    >
                      {new Date(order.createdAt).toLocaleDateString(undefined, {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </Text>
                  </View>
                </View>

                {order.items.map((item) => (
                  <Pressable
                    key={item.id}
                    style={[styles.itemRow, { borderTopColor: colors.border }]}
                    onPress={() => handleOpenEditor(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.name}, ${item.quantity} units, revenue ${formatCurrency(item.revenue)}`}
                    accessibilityHint="Opens the cost price editor for this item"
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemName, { color: colors.text }]}>
                        {item.name}
                      </Text>
                      <Text
                        style={[
                          styles.orderSubtitle,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {item.quantity} units · Revenue{' '}
                        {formatCurrency(item.revenue)}
                      </Text>
                    </View>
                    <View style={styles.itemMeta}>
                      <Text
                        style={[styles.itemMetaValue, { color: colors.text }]}
                      >
                        Cost {formatCurrency(item.costPrice)}
                      </Text>
                      <Text
                        style={[
                          styles.orderSubtitle,
                          {
                            color:
                              item.costPrice <= 0
                                ? colors.error
                                : colors.textMuted,
                          },
                        ]}
                      >
                        Profit {formatCurrency(item.profit)}
                      </Text>
                    </View>
                    <Ionicons
                      name="create-outline"
                      size={18}
                      color={colors.textMuted}
                    />
                  </Pressable>
                ))}
              </View>
            ))}
        </ScrollView>

        <Modal
          visible={Boolean(selectedItem)}
          animationType="slide"
          transparent
          onRequestClose={handleCloseEditor}
        >
          <View style={styles.modalBackdrop}>
            <View
              style={[
                styles.modalCard,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Update cost price
              </Text>
              <Text
                style={[styles.orderSubtitle, { color: colors.textSecondary }]}
              >
                {selectedItem?.name}
              </Text>
              <TextInput
                keyboardType="decimal-pad"
                onChangeText={setCostPriceInput}
                placeholder="Enter cost price"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={costPriceInput}
              />
              {saveError ? (
                <Text style={[styles.errorText, { color: colors.error }]}>
                  {saveError}
                </Text>
              ) : null}
              <View style={styles.modalActions}>
                <Pressable
                  onPress={handleCloseEditor}
                  disabled={updateCostPrice.isPending}
                  style={({ pressed }) => ({
                    opacity: updateCostPrice.isPending
                      ? 0.4
                      : pressed
                        ? 0.7
                        : 1,
                  })}
                >
                  <Text
                    style={[styles.cancelText, { color: colors.textSecondary }]}
                  >
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleSave}
                  disabled={updateCostPrice.isPending}
                  style={[
                    styles.saveButton,
                    {
                      backgroundColor: colors.primary,
                      opacity: updateCostPrice.isPending ? 0.6 : 1,
                    },
                  ]}
                >
                  {updateCostPrice.isPending ? (
                    <ActivityIndicator
                      size="small"
                      color={colors.textOnPrimary}
                    />
                  ) : (
                    <Text
                      style={[
                        styles.saveButtonText,
                        { color: colors.textOnPrimary },
                      ]}
                    >
                      Save
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  cancelText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.md,
  },
  container: {
    flex: 1,
  },
  errorText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.sm,
    marginTop: SPACING.sm,
  },
  stateContainer: {
    alignItems: 'center',
    gap: SPACING.md,
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  stateText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.sm,
    textAlign: 'center',
  },
  content: {
    gap: SPACING.md,
    padding: SPACING.lg,
  },
  heroCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
  },
  heroSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.sm,
    marginTop: SPACING.xs,
  },
  heroValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size['2xl'],
    marginTop: SPACING.xs,
  },
  input: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.lg,
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  itemMeta: {
    alignItems: 'flex-end',
    paddingHorizontal: SPACING.sm,
  },
  itemMetaValue: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.sm,
  },
  itemName: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.md,
  },
  itemRow: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: SPACING.xs,
    paddingTop: SPACING.md,
  },
  modalActions: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.lg,
  },
  modalBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    flex: 1,
    justifyContent: 'flex-end',
    padding: SPACING.lg,
  },
  modalCard: {
    borderRadius: RADIUS['2xl'],
    borderWidth: 1,
    padding: SPACING.lg,
  },
  modalTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.xl,
  },
  orderAmount: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
  },
  orderCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.md,
    padding: SPACING.lg,
  },
  orderHeader: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  orderMeta: {
    alignItems: 'flex-end',
  },
  orderSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.sm,
  },
  orderTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.lg,
  },
  saveButton: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  saveButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
  },
  summaryCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    flex: 1,
    padding: SPACING.md,
  },
  summaryLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  summaryValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.xl,
    marginTop: SPACING.xs,
  },
});
