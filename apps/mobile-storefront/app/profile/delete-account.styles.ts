import { StyleSheet } from 'react-native';
import { RADIUS, SHADOWS } from '@/constants/Colors';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 16,
    gap: 14,
    paddingBottom: 28,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.xl,
    padding: 14,
    ...SHADOWS.sm,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  bullet: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 6,
  },
  linkButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  checkboxText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  deleteButton: {
    minHeight: 48,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
