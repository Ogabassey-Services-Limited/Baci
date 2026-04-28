import { getUtilityFooterOffset } from './get-utility-footer-offset';

describe('getUtilityFooterOffset', () => {
  it('returns zero when the keyboard is hidden', () => {
    expect(
      getUtilityFooterOffset({
        bottomInset: 34,
        isKeyboardVisible: false,
        keyboardHeight: 320,
      })
    ).toBe(0);
  });

  it('places the footer above the keyboard with a small gap', () => {
    expect(
      getUtilityFooterOffset({
        bottomInset: 34,
        isKeyboardVisible: true,
        keyboardHeight: 320,
      })
    ).toBe(328);
  });

  it('still keeps a small gap when the reported keyboard height is zero', () => {
    expect(
      getUtilityFooterOffset({
        bottomInset: 34,
        isKeyboardVisible: true,
        keyboardHeight: 0,
      })
    ).toBe(8);
  });
});
