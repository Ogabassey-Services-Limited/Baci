import { StyleSheet } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    gap: SPACING.md,
    padding: SPACING.lg,
  },
  feedbackCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
  },
  feedbackText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.sm,
  },
  heroCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
  },
  heroSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.sm,
    marginTop: SPACING.xs,
  },
  heroTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.xl,
  },
  primaryButton: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  primaryButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
  },
  stateContainer: {
    alignItems: 'center',
    gap: SPACING.md,
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  stateText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.sm,
    textAlign: 'center',
  },
});
