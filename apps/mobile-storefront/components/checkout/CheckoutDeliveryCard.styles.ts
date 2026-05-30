import { StyleSheet } from 'react-native';
import { BRAND, RADIUS, SHADOWS, SPACING } from '@/constants/Colors';

export const checkoutDeliveryCardStyles = StyleSheet.create({
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
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  newAddressIntro: {
    alignItems: 'flex-start',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  newAddressIntroBody: {
    flex: 1,
    gap: 2,
  },
  newAddressIntroText: {
    fontSize: 12,
    lineHeight: 18,
  },
  newAddressIntroTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  saveDetailsSection: {
    gap: SPACING.sm,
  },
  savedAddressDefaultBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  savedAddressDefaultBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  selectInput: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  selectInputText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    marginRight: 8,
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
  summaryTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
