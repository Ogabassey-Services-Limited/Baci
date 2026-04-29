import { StyleSheet } from 'react-native';
import { BRAND, SPACING } from '@/constants/Colors';

export const AIRTIME_FORM_TOKENS = {
  fontSize: {
    xs: 12,
    sm: 13,
    md: 14,
    lg: 15,
    xl: 16,
  },
  fontWeight: {
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  radius: {
    sm: 8,
    lg: 12,
    round: 999,
  },
  space: {
    xxs: 2,
    xs: 6,
    sm: 8,
    md: 12,
    lg: 14,
    xl: 16,
  },
  size: {
    changeButtonHeight: 34,
    inputHeight: 50,
    inlineButtonHeight: 32,
    logoHeight: 34,
    logoWidth: 52,
  },
} as const;

// changeButton, input, inlineButton, quickChip and selectedNetworkCard receive
// borderColor/backgroundColor dynamically from the active theme at render time.
export const airtimeFormStyles = StyleSheet.create({
  scrollView: { flex: 1 },
  content: { padding: SPACING.md },
  sectionTitle: {
    fontSize: AIRTIME_FORM_TOKENS.fontSize.xl,
    fontWeight: AIRTIME_FORM_TOKENS.fontWeight.semibold,
    marginBottom: AIRTIME_FORM_TOKENS.space.md,
  },
  inputGroup: { marginBottom: AIRTIME_FORM_TOKENS.space.xl },
  label: {
    fontSize: AIRTIME_FORM_TOKENS.fontSize.md,
    marginBottom: AIRTIME_FORM_TOKENS.space.sm,
  },
  changeButton: {
    alignItems: 'center',
    borderRadius: AIRTIME_FORM_TOKENS.radius.round,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: AIRTIME_FORM_TOKENS.size.changeButtonHeight,
    paddingHorizontal: AIRTIME_FORM_TOKENS.space.lg,
  },
  changeButtonText: {
    color: BRAND.primary,
    fontSize: AIRTIME_FORM_TOKENS.fontSize.sm,
    fontWeight: AIRTIME_FORM_TOKENS.fontWeight.bold,
  },
  input: {
    height: AIRTIME_FORM_TOKENS.size.inputHeight,
    borderRadius: AIRTIME_FORM_TOKENS.radius.lg,
    paddingHorizontal: AIRTIME_FORM_TOKENS.space.xl,
    fontSize: AIRTIME_FORM_TOKENS.fontSize.xl,
    borderWidth: 1,
  },
  inlineButton: {
    alignItems: 'center',
    borderRadius: AIRTIME_FORM_TOKENS.radius.round,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: AIRTIME_FORM_TOKENS.size.inlineButtonHeight,
    paddingHorizontal: AIRTIME_FORM_TOKENS.space.md,
  },
  inlineButtonText: {
    fontSize: AIRTIME_FORM_TOKENS.fontSize.sm,
    fontWeight: AIRTIME_FORM_TOKENS.fontWeight.semibold,
  },
  networkPicker: {
    marginBottom: AIRTIME_FORM_TOKENS.space.xl,
  },
  networkPickerHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: AIRTIME_FORM_TOKENS.space.md,
  },
  quickAmounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: AIRTIME_FORM_TOKENS.space.sm,
    marginTop: AIRTIME_FORM_TOKENS.space.sm,
  },
  quickChip: {
    paddingHorizontal: AIRTIME_FORM_TOKENS.space.md,
    paddingVertical: AIRTIME_FORM_TOKENS.space.xs,
    borderRadius: AIRTIME_FORM_TOKENS.radius.sm,
    borderWidth: 1,
  },
  quickChipText: {
    fontSize: AIRTIME_FORM_TOKENS.fontSize.sm,
    fontWeight: AIRTIME_FORM_TOKENS.fontWeight.medium,
  },
  selectedNetworkCard: {
    alignItems: 'center',
    borderRadius: AIRTIME_FORM_TOKENS.radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: AIRTIME_FORM_TOKENS.space.md,
    justifyContent: 'space-between',
    marginBottom: AIRTIME_FORM_TOKENS.space.xl,
    padding: AIRTIME_FORM_TOKENS.space.lg,
  },
  selectedNetworkCopy: {
    flex: 1,
    gap: AIRTIME_FORM_TOKENS.space.xxs,
  },
  selectedNetworkLogo: {
    height: AIRTIME_FORM_TOKENS.size.logoHeight,
    width: AIRTIME_FORM_TOKENS.size.logoWidth,
  },
  selectedNetworkLabel: {
    fontSize: AIRTIME_FORM_TOKENS.fontSize.xs,
    fontWeight: AIRTIME_FORM_TOKENS.fontWeight.semibold,
    textTransform: 'uppercase',
  },
  selectedNetworkName: {
    fontSize: AIRTIME_FORM_TOKENS.fontSize.lg,
    fontWeight: AIRTIME_FORM_TOKENS.fontWeight.bold,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    borderTopWidth: 1,
  },
  payButton: {
    height: AIRTIME_FORM_TOKENS.size.inputHeight,
    borderRadius: AIRTIME_FORM_TOKENS.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButtonText: {
    color: BRAND.onPrimary,
    fontSize: AIRTIME_FORM_TOKENS.fontSize.xl,
    fontWeight: AIRTIME_FORM_TOKENS.fontWeight.semibold,
  },
});
