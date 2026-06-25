import { StyleSheet } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import type { useTheme } from '@/hooks/useTheme';

export type EmailDomainColors = ReturnType<typeof useTheme>['colors'];

export function makeEmailDomainSettingsStyles(colors: EmailDomainColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: SPACING.lg, gap: SPACING.lg },
    intro: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.size.md,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    loading: { marginTop: SPACING['2xl'] },
    card: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.lg,
      gap: SPACING.md,
    },
    label: {
      fontFamily: TYPOGRAPHY.fontFamily.semiBold,
      fontSize: TYPOGRAPHY.size.md,
      color: colors.text,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      fontSize: TYPOGRAPHY.size.lg,
      color: colors.text,
    },
    inputInvalid: { borderColor: colors.error },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: RADIUS.md,
      paddingVertical: SPACING.md,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: SPACING.touchTarget,
    },
    primaryButtonText: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.size.lg,
      color: '#fff',
    },
    secondaryButton: {
      borderColor: colors.border,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      paddingVertical: SPACING.md,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: SPACING.touchTarget,
    },
    secondaryButtonText: {
      fontFamily: TYPOGRAPHY.fontFamily.semiBold,
      fontSize: TYPOGRAPHY.size.md,
      color: colors.text,
    },
    buttonDisabled: { opacity: 0.5 },
    domainRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: SPACING.md,
    },
    domainName: {
      flex: 1,
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.size.xl,
      color: colors.text,
    },
    badge: {
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs,
      borderRadius: RADIUS.full,
    },
    badgeText: {
      fontFamily: TYPOGRAPHY.fontFamily.semiBold,
      fontSize: TYPOGRAPHY.size.xs,
    },
    helper: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.size.sm,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    errorText: {
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.size.sm,
      color: colors.error,
      lineHeight: 18,
    },
    record: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.md,
      padding: SPACING.md,
      gap: SPACING.xs,
    },
    recordType: {
      fontFamily: TYPOGRAPHY.fontFamily.bold,
      fontSize: TYPOGRAPHY.size.xs,
      color: colors.textMuted,
    },
    recordHost: {
      fontFamily: TYPOGRAPHY.fontFamily.medium,
      fontSize: TYPOGRAPHY.size.sm,
      color: colors.text,
    },
    recordValueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: SPACING.sm,
    },
    recordValue: {
      flex: 1,
      fontFamily: TYPOGRAPHY.fontFamily.regular,
      fontSize: TYPOGRAPHY.size.xs,
      color: colors.textSecondary,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: SPACING.md,
    },
  });
}
