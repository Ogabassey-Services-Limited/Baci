import { StyleSheet } from 'react-native';
import { RADIUS, SPACING } from '@/constants/Colors';

export const unlockOrderStyles = StyleSheet.create({
  amount: { fontSize: 14, fontWeight: '800' },
  backButton: { padding: SPACING.sm },
  card: {
    borderRadius: RADIUS['2xl'],
    borderWidth: 1,
    gap: SPACING.sm,
    padding: SPACING.md,
  },
  carrier: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  centered: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  container: { flex: 1 },
  content: { gap: SPACING.md, padding: SPACING.md },
  device: { fontSize: 17, fontWeight: '800' },
  empty: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  message: { fontSize: 13, lineHeight: 19 },
  meta: { flexDirection: 'row', justifyContent: 'space-between' },
  status: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
});
