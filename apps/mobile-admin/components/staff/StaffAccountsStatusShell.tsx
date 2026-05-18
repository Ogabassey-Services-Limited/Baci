import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SPACING, type ThemeColors, TYPOGRAPHY } from '@/constants/theme';
import styles from './staff-accounts.styles';

interface StaffAccountsStatusShellProps {
  colors: ThemeColors;
  onRetry?: () => void;
  status: 'loading' | 'error';
}

export function StaffAccountsStatusShell({
  colors,
  onRetry,
  status,
}: StaffAccountsStatusShellProps) {
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={styles.loadingContainer}>
        {status === 'loading' ? (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            accessibilityLabel="Loading staff accounts"
          />
        ) : (
          <>
            <Ionicons
              name="alert-circle-outline"
              size={48}
              color={colors.notification}
            />
            <Text
              style={[
                styles.emptyTitle,
                { color: colors.text, marginTop: SPACING.md },
              ]}
            >
              Failed to load data
            </Text>
            <Text
              style={[styles.emptyDescription, { color: colors.textSecondary }]}
            >
              Please check your connection and try again.
            </Text>
            {onRetry ? (
              <Pressable
                style={[
                  styles.retryButton,
                  { backgroundColor: colors.primary, marginTop: SPACING.lg },
                ]}
                onPress={onRetry}
                accessibilityRole="button"
                accessibilityLabel="Retry loading data"
              >
                <Text
                  style={{
                    color: colors.textOnPrimary,
                    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
                  }}
                >
                  Retry
                </Text>
              </Pressable>
            ) : null}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
