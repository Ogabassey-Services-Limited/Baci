import { StyleSheet } from 'react-native';
import { SPACING, TYPOGRAPHY } from '@/constants/theme';

/**
 * Static styles for the staff invite acceptance screen. Extracted so
 * `app/invite/[token].tsx` stays within the repo's 300-line module limit.
 * Colour values are applied inline from the theme at the call site.
 */
export const staffInviteStyles = StyleSheet.create({
  button: {
    alignItems: 'center',
    alignSelf: 'stretch',
    borderRadius: 14,
    minHeight: 52,
    justifyContent: 'center',
    marginTop: SPACING.lg,
  },
  buttonText: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
  },
  card: {
    alignItems: 'center',
    borderRadius: 20,
    gap: SPACING.md,
    maxWidth: 420,
    padding: SPACING['2xl'],
    width: '100%',
  },
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  message: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.md,
    lineHeight: 22,
    textAlign: 'center',
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size['2xl'],
    textAlign: 'center',
  },
});
