import { StyleSheet } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';

export const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  triggerRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    gap: SPACING.xs,
    maxWidth: 240,
    minHeight: 44,
  },
  triggerLabel: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    flexShrink: 1,
  },
  statusContainer: {
    minHeight: 44,
    paddingHorizontal: SPACING.lg,
    justifyContent: 'center',
  },
  statusText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: SPACING.xs,
    minHeight: 44,
  },
  addButtonText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
});
