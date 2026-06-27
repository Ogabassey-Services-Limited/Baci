import { StyleSheet } from 'react-native';

export const INSURANCE_COLORS = {
  active: {
    background: '#D1FAE5',
    foreground: '#065F46',
  },
  pending: {
    background: '#FEF3C7',
    foreground: '#92400E',
  },
  cta: {
    foreground: '#ffffff',
  },
} as const;

export const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
  },
  fileClaimButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  trackButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  insuranceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  insuranceContent: {
    marginTop: 12,
    gap: 10,
  },
  insuranceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  insuranceLabel: {
    fontSize: 14,
  },
  insuranceValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  insuranceStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  insuranceStatusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  insuranceProvider: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
});
