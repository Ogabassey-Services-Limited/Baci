import { StyleSheet } from 'react-native';
import { RADIUS, SPACING } from '@/constants/Colors';
import { swapScreenBaseStyleDefinitions } from './swap-screen.styles.base';

export const swapScreenStyles = StyleSheet.create({
  ...swapScreenBaseStyleDefinitions,
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderBottomWidth: 1,
  },
  modalHeaderTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalBody: {
    padding: SPACING.lg,
  },
  uploadArea: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  uploadIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  uploadTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  uploadDesc: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  uploadButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  videoSelected: {
    alignItems: 'center',
    gap: SPACING.sm,
  },
  videoSelectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 20,
  },
  videoSelectedText: {
    fontSize: 13,
    fontWeight: '600',
  },
  removeVideoText: {
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  errorContainer: {
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  analyzeButtonDisabled: {
    opacity: 0.5,
  },
  analyzeButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  analyzingContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  analyzingSpinner: {
    position: 'relative',
    width: 80,
    height: 80,
    marginBottom: SPACING.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sparkleIcon: {
    position: 'absolute',
  },
  analyzingTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  analyzingDesc: {
    fontSize: 14,
  },
  valueCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  valueLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  valueAmount: {
    fontSize: 32,
    fontWeight: '800',
  },
  valueBase: {
    fontSize: 11,
    marginTop: SPACING.xs,
  },
  detailsGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  detailCard: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
  },
  detailLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  observationsCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.lg,
  },
  observationsTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  observationItem: {
    fontSize: 13,
    lineHeight: 22,
  },
  observationNote: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: SPACING.sm,
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  retryButton: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  retryButtonText: {
    fontSize: 14,
  },
});
