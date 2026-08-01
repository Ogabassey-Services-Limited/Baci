import { StyleSheet } from 'react-native';
import { SPACING, TYPOGRAPHY } from '@/constants/theme';

export const securityStyles = StyleSheet.create({
  body: { fontSize: TYPOGRAPHY.size.sm, lineHeight: 20 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    gap: SPACING.md,
    padding: SPACING.lg,
  },
  container: { flex: 1 },
  content: { gap: SPACING.md, padding: SPACING.lg },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 22,
    letterSpacing: 8,
    padding: SPACING.md,
    textAlign: 'center',
  },
  label: { fontSize: TYPOGRAPHY.size.sm, fontWeight: '600' },
  link: { fontSize: TYPOGRAPHY.size.sm, fontWeight: '600' },
  loading: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  note: { fontSize: TYPOGRAPHY.size.xs, lineHeight: 18 },
  primaryButton: {
    alignItems: 'center',
    borderRadius: 10,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: '700',
  },
  secret: {
    fontFamily: 'monospace',
    fontSize: TYPOGRAPHY.size.sm,
    letterSpacing: 1,
  },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
  setupBlock: { gap: SPACING.sm },
  status: { fontSize: TYPOGRAPHY.size.sm, fontWeight: '600' },
  title: { fontSize: TYPOGRAPHY.size.lg, fontWeight: '700' },
  verifyBlock: { gap: SPACING.md },
});
