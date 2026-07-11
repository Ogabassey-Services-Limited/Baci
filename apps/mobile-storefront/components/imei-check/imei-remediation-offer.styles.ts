import { StyleSheet } from 'react-native';
import { RADIUS, SPACING } from '@/constants/Colors';

export const remediationStyles = StyleSheet.create({
  actions: { gap: SPACING.sm, marginTop: SPACING.md },
  amountOption: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flex: 1,
    padding: SPACING.md,
  },
  amountOptions: { flexDirection: 'row', gap: SPACING.sm },
  button: {
    alignItems: 'center',
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: SPACING.md,
  },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  card: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.sm,
    marginTop: SPACING.md,
    padding: SPACING.md,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  fundingButton: { paddingVertical: SPACING.sm },
  fundingText: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  header: { flexDirection: 'row', gap: SPACING.sm },
  headerContent: { flex: 1 },
  icon: {
    alignItems: 'center',
    borderRadius: RADIUS.md,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  message: { fontSize: 13, lineHeight: 19 },
  optionText: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  status: { fontSize: 14, lineHeight: 20 },
  terms: { fontSize: 12, lineHeight: 18 },
  title: { fontSize: 18, fontWeight: '800', marginTop: 2 },
});
