import Ionicons from '@react-native-vector-icons/ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

/** Shown when an active search excludes every otherwise available Follow Up. */
export function FollowUpFilteredEmptyState() {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Ionicons name="search-outline" size={56} color={colors.textMuted} />
      <Text style={[styles.title, { color: colors.text }]}>
        No matching follow-ups
      </Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>
        Try a different search to find recent unsuccessful transactions.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: SPACING.sm,
  },
  title: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    marginTop: SPACING.md,
  },
  body: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
  },
});
