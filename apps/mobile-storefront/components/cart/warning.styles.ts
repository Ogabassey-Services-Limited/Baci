import { StyleSheet } from 'react-native';
import { BRAND, palette, SHADOWS } from '@/constants/Colors';

const warningStyles = {
  warningOverlay: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 16,
  },
  warningBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  warningModal: {
    borderRadius: 18,
    padding: 22,
    width: '100%' as const,
    maxWidth: 360,
    ...SHADOWS.xl,
  },
  warningHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    marginBottom: 14,
  },
  warningIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  warningTitle: {
    flex: 1,
    fontSize: 19,
    fontFamily: 'Inter_700Bold',
    color: palette.gray[900],
  },
  warningDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: palette.gray[600],
    marginBottom: 4,
  },
  warningDescriptionBold: {
    fontFamily: 'Inter_600SemiBold',
  },
  warningDescriptionEmphasis: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 18,
  },
  warningClose: {
    alignSelf: 'flex-start' as const,
    padding: 4,
  },
  warningButtons: {
    gap: 10,
  },
  warningPrimaryButton: {
    backgroundColor: BRAND.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center' as const,
  },
  warningPrimaryButtonText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
  warningSecondaryButton: {
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    borderWidth: 1,
  },
  warningSecondaryButtonText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: palette.gray[800],
  },
  warningCancelButton: {
    paddingVertical: 10,
    alignItems: 'center' as const,
  },
  warningCancelButtonText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: palette.gray[500],
  },
  warningButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  warningButtonDisabled: {
    opacity: 0.45,
  },
  priceChangeList: {
    gap: 8,
    marginBottom: 18,
  },
  priceChangeRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  priceChangeName: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  priceChangeValues: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  priceChangeOld: {
    fontSize: 13,
    textDecorationLine: 'line-through' as const,
  },
  priceChangeNew: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
} as const;

export default warningStyles;
