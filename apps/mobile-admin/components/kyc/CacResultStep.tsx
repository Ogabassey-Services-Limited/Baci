import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface CacResultStepProps {
  verified: boolean;
  reason?: string;
  onTryAgain: () => void;
}

export default function CacResultStep({
  verified,
  reason,
  onTryAgain,
}: CacResultStepProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: verified ? colors.successLight : colors.errorLight,
        },
      ]}
    >
      <Ionicons
        name={verified ? 'checkmark-circle' : 'alert-circle'}
        size={24}
        color={verified ? colors.success : colors.error}
      />
      <Text
        style={[
          styles.text,
          { color: verified ? colors.success : colors.error },
        ]}
      >
        {verified
          ? 'Certificate verified successfully'
          : (reason ?? 'Verification failed')}
      </Text>
      {!verified && (
        <Pressable
          style={[styles.retryButton, { borderColor: colors.error }]}
          onPress={onTryAgain}
          accessibilityRole="button"
          accessibilityLabel="Try again to resubmit CAC document"
        >
          <Text style={[styles.retryText, { color: colors.error }]}>
            Try Again
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: RADIUS.sm,
    padding: SPACING.lg,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  text: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.md,
    textAlign: 'center',
  },
  retryButton: {
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  retryText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.md,
  },
});
