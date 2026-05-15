import { StyleSheet } from 'react-native';
import { SPACING } from '@/constants/Colors';

// Reserves space below the scroll content for the absolutely-positioned
// "Verify Now" footer button so the last form row is not hidden behind it.
const IMEI_CHECK_BOTTOM_PADDING = 100;

export const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: IMEI_CHECK_BOTTOM_PADDING,
  },
});
