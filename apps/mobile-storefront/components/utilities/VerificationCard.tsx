import Ionicons from '@react-native-vector-icons/ionicons';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { RADIUS, withAlpha } from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';

interface VerificationCardProps {
  verified: boolean;
  customerName?: string;
  message?: string;
  isLoading: boolean;
}

export function VerificationCard({
  verified,
  customerName,
  message,
  isLoading,
}: VerificationCardProps) {
  const { colors, isDark } = useTheme();

  if (isLoading) {
    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: isDark
              ? withAlpha(colors.white, 0.05)
              : colors.muted,
            borderColor: colors.border,
          },
        ]}
      >
        <ActivityIndicator size="small" color={colors.textSecondary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Verifying customer…
        </Text>
      </View>
    );
  }

  if (verified) {
    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: isDark
              ? withAlpha(colors.success, 0.1)
              : withAlpha(colors.success, 0.05),
            borderColor: withAlpha(colors.success, 0.2),
          },
        ]}
      >
        <Ionicons name="checkmark-circle" size={20} color={colors.success} />
        <View>
          <Text style={[styles.successName, { color: colors.success }]}>
            {customerName}
          </Text>
          <Text style={[styles.successLabel, { color: colors.success }]}>
            Customer verified
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark
            ? withAlpha(colors.error, 0.1)
            : withAlpha(colors.error, 0.05),
          borderColor: withAlpha(colors.error, 0.2),
        },
      ]}
    >
      <Ionicons name="close-circle" size={20} color={colors.error} />
      <Text style={[styles.errorText, { color: colors.error }]}>
        {message || 'Verification failed'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
  },
  loadingText: {
    fontSize: 14,
  },
  successName: {
    fontSize: 14,
    fontWeight: '600',
  },
  successLabel: {
    fontSize: 12,
  },
  errorText: {
    fontSize: 14,
    flex: 1,
  },
});
