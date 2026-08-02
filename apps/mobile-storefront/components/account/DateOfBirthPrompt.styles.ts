import { StyleSheet } from 'react-native';
import { RADIUS, SPACING } from '@/constants/Colors';

export const styles = StyleSheet.create({
  container: {
    gap: SPACING.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
  field: {
    borderWidth: 1,
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
  },
  fieldText: {
    fontSize: 15,
  },
  helperText: {
    fontSize: 12,
  },
  errorText: {
    fontSize: 12,
  },
  submitButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.xl,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
