import { StyleSheet } from 'react-native';

export const orderDetailsOverviewStyles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    borderRadius: 12,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  avatarPlaceholder: {
    alignItems: 'center',
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  customerDetail: {
    fontSize: 13,
    marginTop: 2,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 17,
    fontWeight: '700',
  },
  customerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  orderDate: {
    fontSize: 13,
    fontWeight: '600',
  },
  primaryAction: {
    alignItems: 'center',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 14,
  },
  primaryActionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  progressContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 18,
  },
  progressDot: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 2,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  progressLabel: {
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  progressLine: {
    flex: 1,
    height: 3,
    marginHorizontal: 4,
  },
  progressStep: {
    alignItems: 'center',
    width: 64,
  },
  receiptButton: {
    alignItems: 'center',
    borderRadius: 12,
    gap: 6,
    justifyContent: 'center',
    minWidth: 96,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  receiptButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryAction: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 14,
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  sourceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  sourceText: {
    fontSize: 12,
  },
  statusBadgeBig: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  statusHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusNote: {
    fontSize: 12,
    marginTop: 16,
  },
  statusTextBig: {
    fontSize: 12,
    fontWeight: '700',
  },
});
