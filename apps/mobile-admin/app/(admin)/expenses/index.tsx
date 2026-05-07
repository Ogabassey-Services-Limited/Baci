/**
 * Expenses List Screen
 * View and manage business expenses
 */

import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { isSameMonth, parseISO } from 'date-fns';
import { Stack, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenSkeleton } from '@/components/ui/ScreenSkeleton';
import { useBranchScope } from '@/hooks/useBranchScope';
import { useMerchant } from '@/hooks/useMerchant';
import { useTheme } from '@/hooks/useTheme';
import { getBranchScopeKey } from '@/lib/branch-scope-query';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { ExpenseListItem } from './ExpenseListItem';
import { styles } from './expenses-list.styles';
import type { Expense } from './expenses-list.types';

function getExpenseErrorMessage() {
  return 'Please try again later.';
}

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
            <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
              {getExpenseErrorMessage()}
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
          <Ionicons name="add" size={32} color="#FFFFFF" />
        </Pressable>
      </SafeAreaView>
    </>
  );
}
