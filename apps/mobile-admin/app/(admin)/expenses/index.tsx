/**
 * Expenses List Screen
 * View and manage business expenses
 */

import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { format, isSameMonth, parseISO } from 'date-fns';
import { Stack, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenSkeleton } from '@/components/ui/ScreenSkeleton';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useBranchScope } from '@/hooks/useBranchScope';
import { useMerchant } from '@/hooks/useMerchant';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';

interface Expense {
  id: string;
  amount: number;
  category: string;
  description: string | null;
  date: string;
  receipt_url: string | null;
  branch_id: string | null;
}

export default function ExpensesScreen() {
  const { colors, shadows, isDark } = useTheme();
  const router = useRouter();
  const { merchant } = useMerchant();
  const { scope } = useBranchScope();
  const branchScopeKey = scope.type === 'branch' ? scope.branchId : 'all';

  const {
    data: expenses,
    error: expensesError,
    isError: hasExpensesError,
    isLoading,
  } = useQuery({
    queryKey: ['expenses', merchant?.id, branchScopeKey],
    queryFn: async () => {
      if (!merchant?.id) return [];
      let query = supabase
        .from('expenses')
        .select(
          'id, amount, category, description, date, receipt_url, branch_id'
        )
        .eq('merchant_id', merchant.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (scope.type === 'branch') {
        query = query.eq('branch_id', scope.branchId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data ?? []) as Expense[];
    },
    enabled: !!merchant?.id,
  });

  const monthlyTotal = (() => {
    if (!expenses) return 0;
    const now = new Date();
    return expenses
      .filter((e) => isSameMonth(parseISO(e.date), now))
      .reduce((sum, e) => sum + Number(e.amount), 0);
  })();

  const renderExpenseItem = ({ item }: { item: Expense }) => (
    <Pressable
      style={[
        styles.expenseItem,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
      onPress={() => router.push(`/expenses/${item.id}`)}
    >
      <View
        style={[
          styles.categoryIcon,
          { backgroundColor: `${colors.primary}15` },
        ]}
      >
        <Ionicons name="pricetag-outline" size={20} color={colors.primary} />
      </View>

      <View style={styles.expenseDetails}>
        <Text style={[styles.expenseCategory, { color: colors.text }]}>
          {item.category}
        </Text>
        {item.description ? (
          <Text
            style={[styles.expenseDescription, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {item.description}
          </Text>
        ) : null}
        <Text style={[styles.expenseDate, { color: colors.textMuted }]}>
          {format(parseISO(item.date), 'MMM d, yyyy')}
        </Text>
      </View>

      <View style={styles.expenseAmount}>
        <Text style={[styles.amountText, { color: colors.text }]}>
          {formatCurrency(
            item.amount,
            undefined,
            merchant?.payout_currency || 'NGN'
          )}
        </Text>
        {item.receipt_url ? (
          <Ionicons
            name="document-attach-outline"
            size={14}
            color={colors.textSecondary}
            style={{ marginTop: 4 }}
          />
        ) : null}
      </View>
    </Pressable>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Expenses',
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              style={styles.headerButton}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/expenses/new')}
              style={styles.headerButton}
            >
              <Ionicons name="add" size={24} color={colors.primary} />
            </Pressable>
          ),
        }}
      />
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <SystemBars style={isDark ? 'light' : 'dark'} />

        {/* Summary Card */}
        <View style={styles.summaryContainer}>
          <View
            style={[
              styles.summaryCard,
              { backgroundColor: colors.primary },
              shadows.md,
            ]}
          >
            <Text style={styles.summaryLabel}>Total this Month</Text>
            <Text style={styles.summaryAmount}>
              {formatCurrency(
                monthlyTotal,
                undefined,
                merchant?.payout_currency || 'NGN'
              )}
            </Text>
            <View style={styles.summaryTrend}>
              <Ionicons name="trending-up" size={16} color="#ffffffcc" />
              <Text style={styles.summaryTrendText}> recorded spending</Text>
            </View>
          </View>
        </View>

        {/* Expenses List */}
        {isLoading ? (
          <ScreenSkeleton variant="list" cards={4} />
        ) : hasExpensesError ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="warning-outline"
              size={64}
              color={colors.textMuted}
            />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Could not load expenses
            </Text>
            <Text
              style={[
                styles.emptySubtext,
                { color: colors.textMuted },
              ]}
            >
              {expensesError instanceof Error
                ? expensesError.message
                : 'Please try again later'}
            </Text>
          </View>
        ) : (
          <FlashList
            data={expenses ?? []}
            renderItem={renderExpenseItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons
                  name="receipt-outline"
                  size={64}
                  color={colors.textMuted}
                />
                <Text
                  style={[styles.emptyText, { color: colors.textSecondary }]}
                >
                  No expenses recorded yet
                </Text>
                <Pressable
                  style={[
                    styles.emptyButton,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => router.push('/expenses/new')}
                >
                  <Text
                    style={[styles.emptyButtonText, { color: colors.primary }]}
                  >
                    Add your first expense
                  </Text>
                </Pressable>
              </View>
            }
          />
        )}

        {/* FAB */}
        <Pressable
          style={[styles.fab, { backgroundColor: colors.primary }, shadows.lg]}
          onPress={() => router.push('/expenses/new')}
        >
          <Ionicons name="add" size={32} color="#FFFFFF" />
        </Pressable>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerButton: { padding: SPACING.sm },
  summaryContainer: { padding: SPACING.lg, paddingBottom: SPACING.sm },
  summaryCard: {
    padding: SPACING.xl,
    borderRadius: RADIUS.xl,
  },
  summaryLabel: {
    color: '#ffffffcc',
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    marginBottom: SPACING.xs,
  },
  summaryAmount: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.size['3xl'],
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginBottom: SPACING.md,
  },
  summaryTrend: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  summaryTrendText: {
    color: '#ffffffcc',
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },

  listContent: { padding: SPACING.lg, paddingBottom: 100 },
  expenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  expenseDetails: { flex: 1 },
  expenseCategory: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    marginBottom: 2,
  },
  expenseDescription: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginBottom: 2,
  },
  expenseDate: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  expenseAmount: { alignItems: 'flex-end' },
  amountText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },

  fab: {
    position: 'absolute',
    bottom: SPACING.xl,
    right: SPACING.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING['3xl'],
    marginTop: SPACING.xl,
  },
  emptyText: {
    marginTop: SPACING.md,
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    textAlign: 'center',
  },
  emptySubtext: {
    marginTop: SPACING.xs,
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: SPACING.lg,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  emptyButtonText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
});
