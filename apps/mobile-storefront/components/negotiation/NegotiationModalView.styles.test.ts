import { describe, expect, it } from '@jest/globals';
import { StyleSheet } from 'react-native';
import { negotiationModalViewStyles } from './NegotiationModalView.styles';

describe('negotiationModalViewStyles', () => {
  it('preserves the modal overlay and centered container layout', () => {
    expect(negotiationModalViewStyles.overlay).toMatchObject({
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.65)',
    });
    expect(negotiationModalViewStyles.backdrop).toEqual(
      StyleSheet.absoluteFill
    );
    expect(negotiationModalViewStyles.modalContainer).toMatchObject({
      width: '90%',
      maxWidth: 400,
      borderRadius: 24,
      overflow: 'hidden',
    });
  });

  it('keeps product and price sections aligned for the compact negotiation form', () => {
    expect(negotiationModalViewStyles.productInfo).toMatchObject({
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      borderWidth: 1,
      borderRadius: 16,
    });
    expect(negotiationModalViewStyles.productInfoText).toMatchObject({
      flex: 1,
    });
    expect(negotiationModalViewStyles.productPriceColumn).toMatchObject({
      alignItems: 'flex-end',
    });
  });

  it('keeps primary action groups tappable and visually grouped', () => {
    expect(negotiationModalViewStyles.submitButton).toMatchObject({
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
    });
    expect(negotiationModalViewStyles.acceptButton).toMatchObject({
      borderRadius: 12,
      paddingVertical: 11,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    });
    expect(negotiationModalViewStyles.uploadActions).toMatchObject({
      flexDirection: 'row',
      gap: 8,
    });
  });
});
