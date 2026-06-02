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

  it('keeps the footer above the keyboard without double-counting the bottom inset', () => {
    expect(
      getUtilityFooterOffset({
        bottomInset: 34,
        isKeyboardVisible: true,
        keyboardHeight: 320,
      })
    ).toBe(286);
  });

  it('keeps the footer at the container bottom when keyboard height is zero', () => {
    expect(
      getUtilityFooterOffset({
        bottomInset: 34,
        isKeyboardVisible: true,
        keyboardHeight: 0,
      })
    ).toBe(0);
  });
});
