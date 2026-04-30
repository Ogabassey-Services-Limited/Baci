import { useEffect } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type Colors from '@/constants/Colors';
import { BRAND } from '@/constants/Colors';
import { createLogger } from '@/lib/logger';
import { styles } from './history.styles';

const log = createLogger('UtilityHistory');

interface UtilityHistoryEmptyStateProps {
  colors: typeof Colors.light;
  error: Error | null;
  isLoading: boolean;
  refetch: () => void;
}

export default function UtilityHistoryEmptyState({
  colors,
  error,
  isLoading,
  refetch,
}: UtilityHistoryEmptyStateProps) {
  useEffect(() => {
    if (error) {
      log.error('Failed to load utility history', error);
    }
  }, [error]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator
          accessibilityLabel="Loading utility history"
          accessibilityRole="progressbar"
          size="large"
          color={BRAND.primary}
        />
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
          Something went wrong. Please try again.
        </Text>
        <Pressable
          style={[
            styles.pillButtonBase,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={refetch}
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
