import { StyleSheet } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';

export const styles = StyleSheet.create({
  approvedName: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.sm,
    marginTop: SPACING.xs,
  },
  body: { gap: SPACING.md, marginTop: SPACING.lg },
  card: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerLeft: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.lg,
  },
});
