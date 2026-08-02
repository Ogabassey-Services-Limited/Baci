import { StyleSheet } from 'react-native';
import { RADIUS, SPACING } from '@/constants/Colors';

export const quizDateOfBirthGateStyles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: SPACING.md,
  },
  card: {
    borderRadius: RADIUS['2xl'],
    gap: SPACING.md,
    padding: SPACING.md,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: SPACING.sm,
    justifyContent: 'space-between',
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
  },
  iconButton: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  helperText: {
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
});
