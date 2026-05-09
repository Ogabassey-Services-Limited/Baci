import { StyleSheet } from 'react-native';
import { SPACING } from '@/constants/Colors';

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
    paddingBottom: 100,
  },
});
