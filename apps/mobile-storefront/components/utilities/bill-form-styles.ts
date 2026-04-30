import { StyleSheet } from 'react-native';
import { BRAND, SPACING } from '@/constants/Colors';
import { BILL_FORM_TOKENS } from './bill-form.tokens';

export const billFormStyles = StyleSheet.create({
  scrollView: { flex: 1 },
  content: { padding: SPACING.md },
  amountSection: { marginTop: SPACING.lg },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  input: {
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  inputDisabled: {
    opacity: 0.75,
  },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  optionCard: {
    width: '48%',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  optionName: {
    fontSize: 13,
    fontWeight: '600',
  },
  optionMeta: {
    fontSize: 12,
    marginTop: 6,
  },
  verifyRow: { flexDirection: 'row', gap: 10 },
  verifyInput: { flex: 1 },
  verifyButton: {
    backgroundColor: BRAND.primary,
    height: 50,
    paddingHorizontal: 20,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyButtonText: {
    color: BRAND.onPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  verifiedPill: {
    alignItems: 'center',
    borderRadius: BILL_FORM_TOKENS.pillBorderRadius,
    height: BILL_FORM_TOKENS.pillHeight,
    justifyContent: 'center',
    paddingHorizontal: BILL_FORM_TOKENS.pillPaddingHorizontal,
  },
  verifiedPillText: {
    fontSize: BILL_FORM_TOKENS.fontSizePill,
    fontWeight: BILL_FORM_TOKENS.fontWeightBold,
  },
  repeatReadyText: {
    fontSize: BILL_FORM_TOKENS.fontSizeSmall,
    marginTop: BILL_FORM_TOKENS.marginTopSmall,
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
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButtonText: { color: BRAND.onPrimary, fontSize: 16, fontWeight: '600' },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 12,
  },
});
