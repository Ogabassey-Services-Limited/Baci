import { StyleSheet } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';

/** Styles for the store-settings route screen. */
export const storeSettingsStyles = StyleSheet.create({
  container: { flex: 1 },
  backButton: { padding: SPACING.sm, marginLeft: -SPACING.sm },
  saveButton: { padding: SPACING.sm },
  saveText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  scrollContent: { padding: SPACING.lg, paddingBottom: SPACING['3xl'] },
  card: {
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
  },
  label: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    marginBottom: SPACING.sm,
  },
});
