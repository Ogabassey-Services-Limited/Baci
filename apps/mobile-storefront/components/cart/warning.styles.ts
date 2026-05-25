import { StyleSheet } from 'react-native';
import { BRAND, SHADOWS, palette } from '@/constants/Colors';

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
    borderRadius: 20,
    padding: 28,
    width: '100%' as const,
    maxWidth: 400,
    ...SHADOWS.xl,
  },
  warningHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 16,
    marginBottom: 18,
  },
  warningIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  warningTitle: {
    flex: 1,
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: palette.gray[900],
  },
  warningDescription: {
    fontSize: 15,
    lineHeight: 24,
    color: palette.gray[600],
    marginBottom: 22,
  },
  warningDescriptionBold: {
    fontFamily: 'Inter_600SemiBold',
  },
  warningButtons: {
    gap: 12,
  },
  warningPrimaryButton: {
    backgroundColor: BRAND.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center' as const,
  },
  warningPrimaryButtonText: {
    fontSize: 16,
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
    fontSize: 16,
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
} as const;

export default warningStyles;
