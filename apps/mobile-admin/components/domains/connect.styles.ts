import { StyleSheet } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';

export const connectStyles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: SPACING.lg },
  title: {
    fontSize: TYPOGRAPHY.size.xl,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    lineHeight: 22,
  },
  successHeader: {
    alignItems: 'center',
    padding: SPACING.xl,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  button: {
    height: 50,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.xl,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  recordCard: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  label: { fontSize: 14, fontFamily: TYPOGRAPHY.fontFamily.medium },
  value: { fontSize: 14, fontFamily: TYPOGRAPHY.fontFamily.semiBold },
  copyValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 6,
    borderRadius: RADIUS.sm,
    maxWidth: '70%',
  },
  tokenText: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    flex: 1,
  },
  divider: { height: 1, width: '100%' },
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: SPACING.lg,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
  },
  noteText: { fontSize: 13, fontFamily: TYPOGRAPHY.fontFamily.medium, flex: 1 },
});
