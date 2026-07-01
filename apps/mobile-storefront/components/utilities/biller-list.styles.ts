import { StyleSheet } from 'react-native';
import { BRAND, SPACING } from '@/constants/Colors';

export const billerListStyles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  card: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 60,
    height: 40,
    marginBottom: 8,
  },
  initialSpacing: {
    marginBottom: 8,
  },
  billerName: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  changeButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 14,
  },
  changeButtonText: {
    color: BRAND.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  centered: {
    padding: SPACING.lg,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center' as const,
    color: '#DC2626',
  },
  selectedCard: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    padding: 14,
    marginBottom: 20,
  },
  selectedCardMain: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  selectedCopy: {
    flex: 1,
    gap: 2,
  },
  selectedLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  selectedLogo: {
    height: 32,
    width: 48,
  },
  selectedInitial: {
    height: 32,
    width: 32,
  },
  selectedName: {
    fontSize: 15,
    fontWeight: '700',
  },
  otherProvidersRow: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  otherProvidersText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
