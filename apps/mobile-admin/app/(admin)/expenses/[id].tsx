/**
 * Expense Detail Screen
 * View details of a specific expense
 */

import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Stack, useLocalSearchParams } from 'expo-router';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useBranches } from '@/hooks/useBranches';
import { useMerchant } from '@/hooks/useMerchant';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';

export default function ExpenseDetailScreen() {
  const { colors, isDark, shadows } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { merchant } = useMerchant();
  const { data: branches = [], isLoading: branchesLoading } = useBranches();

  const {
    data: expense,
    error: expenseError,
    isError: hasExpenseError,
    isLoading,
  } = useQuery({
    queryKey: ['expense', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select(
          'id, amount, category, date, reference, description, receipt_url, branch_id'
        )
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const formatCurrency = (amount: number, currency: string) => {
    return `${currency === 'NGN' ? '₦' : currency}${amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  };
  const branchName = expense?.branch_id
    ? (branches.find((branch) => branch.id === expense.branch_id)?.name ??
      (branchesLoading ? 'Loading branch...' : 'Unknown branch'))
    : 'Unassigned';

  if (isLoading) {
    return (
      <View
        style={[
          styles.container,
          styles.center,
          { backgroundColor: colors.background },
        ]}
      >
        <Text style={{ color: colors.textSecondary }}>
          Loading expense details...
        </Text>
      </View>
    );
  }

  if (hasExpenseError) {
    return (
      <View
        style={[
          styles.container,
          styles.center,
          styles.errorContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <Ionicons name="warning-outline" size={32} color={colors.textSecondary} />
        <Text style={{ color: colors.textSecondary }}>
          Could not load expense.
        </Text>
        <Text style={{ color: colors.textSecondary }}>
          {expenseError instanceof Error
            ? expenseError.message
            : 'Please try again later.'}
        </Text>
      </View>
    );
  }

  if (!expense) {
    return (
      <View
        style={[
          styles.container,
          styles.center,
          { backgroundColor: colors.background },
        ]}
      >
        <Text style={{ color: colors.textSecondary }}>Expense not found.</Text>
      </View>
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

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View
          style={[
            styles.headerCard,
            { backgroundColor: colors.card },
            shadows.sm,
          ]}
        >
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: `${colors.primary}15` },
            ]}
          >
            <Ionicons name="receipt-outline" size={32} color={colors.primary} />
          </View>
          <Text style={[styles.amountText, { color: colors.text }]}>
            {formatCurrency(expense.amount, merchant?.payout_currency || 'NGN')}
          </Text>
          <Text style={[styles.categoryText, { color: colors.textSecondary }]}>
            {expense.category}
          </Text>
        </View>

        <View
          style={[
            styles.infoSection,
            { backgroundColor: colors.card },
            shadows.sm,
          ]}
        >
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
              Date
            </Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {format(parseISO(expense.date), 'MMMM d, yyyy')}
            </Text>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
              Reference
            </Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {expense.reference || 'None'}
            </Text>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
              Branch
            </Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {branchName}
            </Text>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
              Description
            </Text>
            <Text
              style={[
                styles.infoValue,
                { color: colors.text, textAlign: 'right' },
              ]}
            >
              {expense.description || 'No description provided'}
            </Text>
          </View>
        </View>

        {expense.receipt_url ? (
          <View style={styles.receiptSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Receipt
            </Text>
            <Pressable
              style={[
                styles.receiptCard,
                { backgroundColor: colors.card },
                shadows.sm,
              ]}
              onPress={() =>
                Alert.alert('View Receipt', 'Opening receipt image...')
              }
            >
              <Ionicons name="image-outline" size={24} color={colors.primary} />
              <Text style={[styles.receiptText, { color: colors.primary }]}>
                View Attached Receipt
              </Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    gap: SPACING.sm,
    padding: SPACING.lg,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  headerCard: {
    padding: SPACING.xl,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  amountText: {
    fontSize: 32,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  categoryText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  infoSection: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  infoLabel: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  infoValue: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    flex: 1,
    textAlign: 'right',
    paddingLeft: SPACING.md,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  receiptSection: {
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    marginLeft: SPACING.xs,
  },
  receiptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    gap: SPACING.md,
  },
  receiptText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
});
