import { StyleSheet } from 'react-native';
import { SPACING } from '@/constants/Colors';

export const billFormStyles = StyleSheet.create({
  scrollView: { flex: 1 },
  content: { padding: SPACING.md },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  input: {
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  inputDisabled: {
    opacity: 0.75,
  },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  optionCard: {
    width: '48%',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  optionName: {
    fontSize: 13,
    fontWeight: '600',
  },
  optionMeta: {
    fontSize: 12,
    marginTop: 6,
  },
  verifyRow: { flexDirection: 'row', gap: 10 },
  verifyInput: { flex: 1 },
  verifyButton: {
    backgroundColor: '#1F2937',
    height: 50,
    paddingHorizontal: 20,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyButtonText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  verifiedPill: {
    alignItems: 'center',
    backgroundColor: '#16A34A',
    borderRadius: 12,
    height: 50,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  verifiedPillText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  repeatReadyText: {
    fontSize: 13,
    marginTop: 10,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    borderTopWidth: 1,
  },
  payButton: {
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 12,
  },
});
