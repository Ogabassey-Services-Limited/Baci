import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Colors, { BRAND } from '@/constants/Colors';
import { styles } from './history.styles';

interface UtilityHistoryEmptyStateProps {
  colors: typeof Colors.light;
  error: Error | null;
  isLoading: boolean;
  refetch: () => unknown;
}

export default function UtilityHistoryEmptyState({
  colors,
  error,
  isLoading,
  refetch,
}: UtilityHistoryEmptyStateProps) {
  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={BRAND.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.stateCard, { borderColor: colors.border }]}>
        <Text style={[styles.stateTitle, { color: colors.text }]}>
          Unable to load history
        </Text>
        <Text style={[styles.stateMessage, { color: colors.textSecondary }]}>
          {error.message}
        </Text>
        <Pressable
          style={[
            styles.pillButtonBase,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={() => refetch()}
          accessibilityRole="button"
          accessibilityLabel="Retry loading utility history"
        >
          <Text style={[styles.retryText, { color: colors.text }]}>
            Try Again
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.stateCard, { borderColor: colors.border }]}>
      <Text style={[styles.stateTitle, { color: colors.text }]}>
        No history yet
      </Text>
      <Text style={[styles.stateMessage, { color: colors.textSecondary }]}>
        Completed utility purchases will appear here once they are available for
        this account.
      </Text>
    </View>
  );
}
