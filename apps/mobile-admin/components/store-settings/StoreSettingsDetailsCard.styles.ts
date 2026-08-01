import { StyleSheet } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';

export const storeSettingsDetailsStyles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
  },
  label: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.sm,
    marginBottom: SPACING.sm,
  },
  input: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.md,
    padding: SPACING.md,
  },
  multilineInput: {
    minHeight: 80,
  },
  phoneContainer: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    height: 58,
    overflow: 'hidden',
    width: '100%',
  },
  phoneTextContainer: {
    backgroundColor: 'transparent',
  },
  phoneTextInput: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.md,
    height: 54,
  },
  phoneCodeText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.md,
  },
  phoneCountryPicker: {
    minWidth: 72,
    width: 72,
  },
  phoneFlag: {
    fontSize: 24,
  },
  addressInput: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.md,
    minHeight: 52,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    width: '100%',
  },
  addressSuggestions: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginTop: SPACING.sm,
    overflow: 'hidden',
  },
  addressSuggestion: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  addressMainText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.sm,
  },
  addressSecondaryText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.xs,
    marginTop: 2,
  },
  googleAttribution: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.xs,
    paddingVertical: SPACING.sm,
    textAlign: 'center',
  },
  regionGroup: {
    gap: SPACING.md,
  },
  sublabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.sm,
    marginBottom: SPACING.xs,
  },
  readOnlyInput: {
    alignItems: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: 'row',
    height: 48,
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
  },
});
