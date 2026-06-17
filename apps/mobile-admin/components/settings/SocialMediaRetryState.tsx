import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  RADIUS,
  SPACING,
  type ThemeColors,
  TYPOGRAPHY,
} from '@/constants/theme';

interface SocialMediaRetryStateProps {
  colors: ThemeColors;
  onRetry: () => void;
}

/**
 * Failed-but-settled / no-merchant load state for the Social Media screen.
 * Rendered instead of an empty form so Save can never write blank handles over
 * the merchant's saved social_media. (V4 drift guard)
 */
export default function SocialMediaRetryState({
  colors,
  onRetry,
}: SocialMediaRetryStateProps) {
  return (
    <View style={styles.errorState}>
      <Ionicons
        name="cloud-offline-outline"
        size={48}
        color={colors.textSecondary}
      />
      <Text style={[styles.errorTitle, { color: colors.text }]}>
        Couldn't load your settings
      </Text>
      <Text style={[styles.errorSubtitle, { color: colors.textSecondary }]}>
        We couldn't reach your store data. Saving now could overwrite your saved
        links, so please retry.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={[styles.retryButton, { backgroundColor: colors.primary }]}
      >
        <Text style={[styles.retryText, { color: colors.textOnPrimary }]}>
          Retry
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    gap: SPACING.md,
  },
  errorTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    marginTop: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.md,
  },
  retryText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
});
