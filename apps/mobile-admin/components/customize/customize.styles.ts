import { StyleSheet } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';

export const customizeStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  errorContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING['2xl'],
  },
  errorText: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.xl,
    marginTop: SPACING.lg,
  },
  errorSubtext: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.md,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  headerButton: {
    minHeight: 44,
    minWidth: 44,
  },
  headerButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.md,
  },
  publishButton: {
    alignItems: 'center',
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 84,
    paddingHorizontal: SPACING.lg,
  },
  publishButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
  },
  toggleContainer: {
    borderRadius: RADIUS.xl,
    flexDirection: 'row',
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    padding: SPACING.xs,
  },
  toggleButton: {
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    flex: 1,
    flexDirection: 'row',
    gap: SPACING.sm,
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  toggleActive: {
    shadowOpacity: 0,
  },
  toggleText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.md,
  },
});
