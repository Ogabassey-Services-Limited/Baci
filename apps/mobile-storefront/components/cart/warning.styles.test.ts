import { describe, expect, it } from '@jest/globals';
import { StyleSheet } from 'react-native';
import { BRAND, palette, SHADOWS } from '@/constants/Colors';
import warningStyles from './warning.styles';

describe('warningStyles', () => {
  it('preserves the modal overlay, backdrop, and card layout', () => {
    expect(warningStyles.warningOverlay).toMatchObject({
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    });
    expect(warningStyles.warningBackdrop).toMatchObject({
      ...StyleSheet.absoluteFill,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    });
    expect(warningStyles.warningModal).toMatchObject({
      borderRadius: 18,
      padding: 22,
      width: '100%',
      maxWidth: 360,
      ...SHADOWS.xl,
    });
  });

  it('keeps warning text styles tied to the app palette and typography', () => {
    expect(warningStyles.warningTitle).toMatchObject({
      flex: 1,
      fontSize: 19,
      fontFamily: 'Inter_700Bold',
      color: palette.gray[900],
    });
    expect(warningStyles.warningDescription).toMatchObject({
      fontSize: 14,
      lineHeight: 21,
      color: palette.gray[600],
    });
    expect(warningStyles.warningSecondaryButtonText).toMatchObject({
      fontSize: 15,
      fontFamily: 'Inter_700Bold',
      color: palette.gray[800],
    });
  });

  it('keeps action buttons tappable and visually grouped', () => {
    expect(warningStyles.warningPrimaryButton).toMatchObject({
      backgroundColor: BRAND.primary,
      paddingVertical: 16,
      borderRadius: 16,
      alignItems: 'center',
    });
    expect(warningStyles.warningSecondaryButton).toMatchObject({
      paddingVertical: 14,
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
    });
    expect(warningStyles.warningButtonPressed).toEqual({
      opacity: 0.9,
      transform: [{ scale: 0.98 }],
    });
    expect(warningStyles.warningButtonDisabled).toEqual({ opacity: 0.45 });
  });
});
