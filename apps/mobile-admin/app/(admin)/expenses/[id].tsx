/**
 * Expense Detail Screen
 * View details of a specific expense
 */

import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBranchScope } from '@/hooks/useBranchScope';
import { useBranches } from '@/hooks/useBranches';
import { useMerchant } from '@/hooks/useMerchant';
import { useTheme } from '@/hooks/useTheme';
import { getBranchScopeKey } from '@/lib/branch-scope-query';
import { supabase } from '@/lib/supabase';
import { ExpenseDetails } from './ExpenseDetails';
import { ExpenseStatusShell } from './ExpenseStatusShell';
import { styles } from './expense-detail.styles';
import type { ExpenseDetail } from './types';

export default function ExpenseDetailScreen() {
  const { colors, isDark, shadows } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { merchant } = useMerchant();
  const { scope } = useBranchScope();
  const { data: branches = [], isLoading: branchesLoading } = useBranches();
  const branchScopeKey = getBranchScopeKey(scope);

  const {
    data: expense,
    error: expenseError,
    isError: hasExpenseError,
    isLoading,
  } = useQuery({
    queryKey: ['expense', merchant?.id, branchScopeKey, id],
    queryFn: async () => {
      if (!merchant?.id) throw new Error('Merchant ID missing');
      let query = supabase
        .from('expenses')
        .select(
          'id, amount, category, date, reference, description, receipt_url, branch_id'
        )
        .eq('id', id)
        .eq('merchant_id', merchant.id);

      if (scope.type === 'branch') {
        query = query.eq('branch_id', scope.branchId);
      }

      const { data, error } = await query.single();
      if (error) throw error;
      return data as ExpenseDetail;
    },
    enabled: !!id && !!merchant?.id,
  });

  const formatCurrency = (amount: number, currency: string) => {
    return `${currency === 'NGN' ? '₦' : currency}${amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  };
  const branchName = expense?.branch_id
    ? (branches.find((branch) => branch.id === expense.branch_id)?.name ??
      (branchesLoading ? 'Loading branch...' : 'Unknown branch'))
    : 'Unassigned';

  let content;
  if (isLoading) {
    content = <ExpenseStatusShell status="loading" colors={colors} />;
  } else if (hasExpenseError) {
    content = (
      <ExpenseStatusShell
        status="error"
        colors={colors}
        errorMessage={
          expenseError instanceof Error ? expenseError.message : undefined
        }
      />
    );
  } else if (!expense) {
    content = <ExpenseStatusShell status="not-found" colors={colors} />;
  } else {
    content = (
      <ExpenseDetails
        expense={expense}
        branchName={branchName}
        colors={colors}
        formattedAmount={formatCurrency(
          expense.amount,
          merchant?.payout_currency ?? 'NGN'
        )}
        cardShadow={shadows.sm}
      />
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['bottom']}
    >
      <Stack.Screen
        options={{
          title: 'Expense Details',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      />
      <SystemBars style={isDark ? 'light' : 'dark'} />

      {content}
    </SafeAreaView>
  );
}
