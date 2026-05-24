import Ionicons from "@react-native-vector-icons/ionicons/static";
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { isSameMonth, isValid, parseISO } from 'date-fns';
import { Stack, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ExpenseListItem } from '@/components/expenses/ExpenseListItem';
import { styles } from '@/components/expenses/expenses-list.styles';
import { ScreenSkeleton } from '@/components/ui/ScreenSkeleton';
import { useBranchScope } from '@/hooks/useBranchScope';
import { useMerchant } from '@/hooks/useMerchant';
import { useTheme } from '@/hooks/useTheme';
import { getBranchScopeKey } from '@/lib/branch-scope-query';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { ExpenseSchema } from '@/schemas/expense';

export default function ExpensesScreen() {
  const { colors, shadows, isDark } = useTheme();
  const router = useRouter();
  const { merchant } = useMerchant();
  const { scope } = useBranchScope();
  const branchScopeKey = getBranchScopeKey(scope);

  const {
    data: expenses,
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
      return ExpenseSchema.array().parse(data ?? []);
    },
    enabled: !!merchant?.id,
  });

  const monthlyTotal = (() => {
    if (!expenses) return 0;
    const now = new Date();
    return expenses
      .filter((e) => {
        const expenseDate = parseISO(e.date);
        return isValid(expenseDate) && isSameMonth(expenseDate, now);
      })
      .reduce((sum, e) => sum + Number(e.amount), 0);
  })();

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
            <Text
              style={[
                styles.summaryLabel,
                { color: colors.textOnPrimary, opacity: 0.8 },
              ]}
            >
              Total this Month
            </Text>
            <Text
              style={[styles.summaryAmount, { color: colors.textOnPrimary }]}
            >
              {formatCurrency(
                monthlyTotal,
                undefined,
                merchant?.payout_currency || 'NGN'
              )}
            </Text>
            <View style={styles.summaryTrend}>
              <Ionicons
                name="trending-up"
                size={16}
                color={colors.textOnPrimary}
                style={{ opacity: 0.8 }}
              />
              <Text
                style={[
                  styles.summaryTrendText,
                  { color: colors.textOnPrimary, opacity: 0.8 },
                ]}
              >
                {' '}
                recorded spending
              </Text>
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
            <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
              Please try again later.
            </Text>
          </View>
        ) : (
          <FlashList
            data={expenses ?? []}
            renderItem={({ item }) => (
              <ExpenseListItem item={item} merchant={merchant} />
            )}
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
          <Ionicons name="add" size={32} color={colors.textOnPrimary} />
        </Pressable>
      </SafeAreaView>
    </>
  );
}
