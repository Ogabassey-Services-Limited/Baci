import { StyleSheet } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';

export const expenseFormStyles = StyleSheet.create({
  content: {
    padding: SPACING.lg,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  label: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.sm,
    marginBottom: SPACING.xs,
    marginLeft: 4,
  },
  required: {
    color: '#ef4444',
  },
  amountContainer: {
    alignItems: 'center',
    borderBottomWidth: 2,
    flexDirection: 'row',
    paddingVertical: SPACING.sm,
  },
  currencyPrefix: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size['3xl'],
    marginRight: SPACING.sm,
  },
  amountInput: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size['3xl'],
  },
  input: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    fontSize: TYPOGRAPHY.size.md,
    minHeight: 100,
    padding: SPACING.md,
    textAlignVertical: 'top',
  },
  selector: {
    alignItems: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: SPACING.md,
  },
  selectorText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.md,
  },
  imageUpload: {
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    height: 200,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  uploadPlaceholder: {
    alignItems: 'center',
    gap: SPACING.sm,
  },
  uploadText: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.sm,
  },
  receiptPreview: {
    height: '100%',
    width: '100%',
  },
  changeImageBadge: {
    alignItems: 'center',
    borderRadius: RADIUS.full,
    bottom: SPACING.md,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    position: 'absolute',
  },
  changeImageText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    borderTopWidth: 1,
    padding: SPACING.lg,
  },
  saveButton: {
    alignItems: 'center',
    borderRadius: RADIUS.xl,
    height: 56,
    justifyContent: 'center',
    padding: SPACING.md,
  },
  saveButtonText: {
    color: '#FFF',
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.lg,
  },
  sheetHeader: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
    paddingBottom: SPACING.md,
  },
  sheetTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.lg,
  },
  categoryOption: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.lg,
  },
  categoryOptionText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.md,
  },
});
