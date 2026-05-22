import { StyleSheet } from 'react-native';
import { BRAND, RADIUS, SHADOWS, SPACING } from '@/constants/Colors';

export const checkoutContactCardStyles = StyleSheet.create({
  accountInfoBanner: {
    alignItems: 'flex-start',
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.md,
  },
  accountInfoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    borderColor: 'transparent',
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    marginBottom: SPACING.sm,
    paddingBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingTop: 14,
    ...SHADOWS.sm,
  },
  cardBody: {
    gap: SPACING.sm,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: SPACING.md,
  },
  cardHeaderActionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  cardHeaderInline: {
    marginBottom: 0,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  checkbox: {
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 2,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  checkboxChecked: {
    backgroundColor: BRAND.primary,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  checkboxRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.sm,
    minHeight: 44,
    paddingVertical: SPACING.xs,
  },
  compactInputGroup: {
    marginBottom: 8,
  },
  contactCardBody: {
    gap: 10,
  },
  fieldError: {
    alignItems: 'center',
    flexDirection: 'row',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 6,
  },
  halfInput: {
    flex: 1,
  },
  inlineActionContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  inlineActionText: {
    color: BRAND.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  inlineEditButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    borderColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  saveDetailsSection: {
    gap: SPACING.sm,
  },
  summaryLine: {
    fontSize: 14,
    lineHeight: 20,
  },
  summaryMetaLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  summaryMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  summaryPanel: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
});
