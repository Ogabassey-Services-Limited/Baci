import { StyleSheet } from 'react-native';
import { RADIUS, SPACING } from '@/constants/Colors';

export const usdtFundingStyles = StyleSheet.create({
  address: { fontSize: 13, lineHeight: 19 },
  addressBox: { borderRadius: RADIUS.lg, gap: SPACING.sm, padding: SPACING.md },
  balance: { fontSize: 28, fontWeight: '900' },
  button: {
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: SPACING.md,
  },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  chain: { borderRadius: RADIUS.md, borderWidth: 1, padding: SPACING.sm },
  chainRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chainText: { fontSize: 13, fontWeight: '700' },
  container: { flex: 1 },
  content: { gap: SPACING.md, padding: SPACING.md },
  error: { fontSize: 13, lineHeight: 19 },
  field: { gap: SPACING.xs },
  input: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 46,
    paddingHorizontal: SPACING.md,
  },
  label: { fontSize: 13, fontWeight: '700' },
  subtitle: { fontSize: 14, lineHeight: 21 },
  title: { fontSize: 22, fontWeight: '900' },
});
