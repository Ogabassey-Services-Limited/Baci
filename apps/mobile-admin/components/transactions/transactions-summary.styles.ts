import { StyleSheet } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';

export const summaryStyles = StyleSheet.create({
  summaryCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    flex: 1,
    padding: SPACING.md,
  },
  summaryLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  summaryValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.xl,
    marginTop: SPACING.xs,
  },
});
