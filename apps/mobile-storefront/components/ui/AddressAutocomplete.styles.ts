import { StyleSheet } from 'react-native';
import { palette, RADIUS, SPACING } from '@/constants/Colors';

export const addressAutocompleteStyles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: SPACING.xs,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.xl,
    minHeight: 52,
    borderColor: 'transparent',
  },
  containerError: {
    borderColor: palette.red[500],
  },
  icon: {
    paddingLeft: SPACING.md,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 12,
    paddingHorizontal: SPACING.sm,
  },
  triggerText: {
    fontSize: 15,
  },
  loader: {
    paddingRight: SPACING.md,
  },
  clearButton: {
    paddingRight: SPACING.md,
    paddingVertical: 8,
  },
  error: {
    fontSize: 12,
    marginTop: 4,
  },
  // Address search sheet (Modal) — mirrors the checkout City/State pickers.
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: SPACING.md,
    maxHeight: '80%',
    minHeight: '45%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  sheetSearchContainer: {
    borderWidth: 1,
    borderRadius: RADIUS.xl,
    paddingHorizontal: 12,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: SPACING.sm,
    borderColor: 'transparent',
    minHeight: 48,
  },
  sheetSearchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 10,
  },
  useTypedRow: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    marginBottom: SPACING.xs,
  },
  useTypedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  useTypedLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    color: palette.amber[600],
    textTransform: 'uppercase',
  },
  useTypedText: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  predictionItem: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  predictionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  predictionPinRail: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  predictionPin: {
    textAlign: 'center',
    marginLeft: 1,
  },
  predictionText: {
    flex: 1,
    flexShrink: 1,
  },
  predictionMain: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  predictionSecondary: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    borderBottomLeftRadius: RADIUS.xl,
    borderBottomRightRadius: RADIUS.xl,
    marginTop: 4,
  },
  footerText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
