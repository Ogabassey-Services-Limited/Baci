import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { styles } from './expense-detail.styles';
import type { ExpenseStatusShellProps } from './types';

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
