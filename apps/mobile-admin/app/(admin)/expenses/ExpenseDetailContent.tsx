import { Ionicons } from '@expo/vector-icons';
import { format, isValid, parseISO } from 'date-fns';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { styles } from '@/app/(admin)/expenses/expense-detail.styles';
import { getTranslucentColor } from '@/lib/colors/sanitize-css-color';

export interface ExpenseDetail {
  id: string;
  amount: number;
  category: string;
  date: string;
  reference: string | null;
  description: string | null;
  receipt_url: string | null;
  branch_id: string | null;
}

interface ExpenseDetailColors {
  background: string;
  border: string;
  card: string;
  primary: string;
  text: string;
  textSecondary: string;
}

interface ExpenseStatusShellProps {
  status: 'loading' | 'error' | 'not-found';
  colors: ExpenseDetailColors;
  errorMessage?: string;
}

interface ExpenseDetailsProps {
  expense: ExpenseDetail;
  branchName: string;
  colors: ExpenseDetailColors;
  formattedAmount: string;
  cardShadow?: StyleProp<ViewStyle>;
}

export function ExpenseStatusShell({
  status,
  colors,
  errorMessage,
}: ExpenseStatusShellProps) {
  if (status === 'error') {
    return (
      <View
        style={[
          styles.container,
          styles.center,
          styles.errorContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <Ionicons
          name="warning-outline"
          size={32}
          color={colors.textSecondary}
        />
        <Text style={{ color: colors.textSecondary }}>
          Could not load expense.
        </Text>
        <Text style={{ color: colors.textSecondary }}>
          {errorMessage ?? 'Please try again later.'}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        styles.center,
        { backgroundColor: colors.background },
      ]}
    >
      <Text style={{ color: colors.textSecondary }}>
        {status === 'loading'
          ? 'Loading expense details...'
          : 'Expense not found.'}
      </Text>
    </View>
  );
}

export function ExpenseDetails({
  expense,
  branchName,
  colors,
  formattedAmount,
  cardShadow,
}: ExpenseDetailsProps) {
  const parsedDate = parseISO(expense.date);
  const displayDate = isValid(parsedDate)
    ? format(parsedDate, 'MMMM d, yyyy')
    : 'Invalid date';
  const primaryBackground = getTranslucentColor(
    colors.primary,
    'rgba(59, 130, 246, 0.15)',
    0.15
  );
  const handleOpenReceipt = async () => {
    const receiptUrl = expense.receipt_url;
    if (!receiptUrl) {
      Alert.alert('Receipt unavailable', 'No receipt image is attached.');
      return;
    }

    if (!/^https?:\/\//i.test(receiptUrl)) {
      Alert.alert('Receipt unavailable', 'This receipt link cannot be opened.');
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(receiptUrl);
      if (!canOpen) {
        Alert.alert(
          'Receipt unavailable',
          'This receipt link cannot be opened.'
        );
        return;
      }

      await Linking.openURL(receiptUrl);
    } catch {
      Alert.alert('Receipt unavailable', 'Could not open this receipt.');
    }
  };

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
    >
      <View
        style={[
          styles.headerCard,
          { backgroundColor: colors.card },
          cardShadow,
        ]}
      >
        <View
          style={[styles.iconContainer, { backgroundColor: primaryBackground }]}
        >
          <Ionicons name="receipt-outline" size={32} color={colors.primary} />
        </View>
        <Text style={[styles.amountText, { color: colors.text }]}>
          {formattedAmount}
        </Text>
        <Text style={[styles.categoryText, { color: colors.textSecondary }]}>
          {expense.category}
        </Text>
      </View>

      <View
        style={[
          styles.infoSection,
          { backgroundColor: colors.card },
          cardShadow,
        ]}
      >
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
            Date
          </Text>
          <Text style={[styles.infoValue, { color: colors.text }]}>
            {displayDate}
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
            Reference
          </Text>
          <Text style={[styles.infoValue, { color: colors.text }]}>
            {expense.reference ?? 'None'}
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
            {expense.description ?? 'No description provided'}
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
              cardShadow,
            ]}
            onPress={() => {
              void handleOpenReceipt();
            }}
            accessibilityRole="button"
            accessibilityLabel="View attached receipt"
            accessibilityHint="Opens the attached receipt image"
          >
            <Ionicons name="image-outline" size={24} color={colors.primary} />
            <Text style={[styles.receiptText, { color: colors.primary }]}>
              View Attached Receipt
            </Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}
