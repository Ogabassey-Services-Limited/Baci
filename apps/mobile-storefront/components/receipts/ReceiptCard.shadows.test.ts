import { getReceiptCardShadowStyle } from './ReceiptCard.shadows';

describe('getReceiptCardShadowStyle', () => {
  it('uses CSS box-shadow on web', () => {
    expect(getReceiptCardShadowStyle('web')).toEqual({
      boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)',
    });
  });

  it('preserves the native receipt-card shadow contract', () => {
    expect(getReceiptCardShadowStyle('native')).toEqual({
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    });
  });
});
