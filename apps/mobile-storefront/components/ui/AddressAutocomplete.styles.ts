import { StyleSheet } from 'react-native';
import { palette, RADIUS, SHADOWS, SPACING } from '@/constants/Colors';

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
  // Floating dropdown rendered by the screen-root suggestions portal —
  // positioned in window coordinates under the field (left/top/width/maxHeight
  // are set dynamically from the measured anchor).
  floatingDropdown: {
    position: 'absolute',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.xl,
    ...SHADOWS.md,
    overflow: 'hidden',
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
