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

  it('subtracts the bottom inset from the keyboard height', () => {
    expect(
      getUtilityFooterOffset({
        bottomInset: 34,
        isKeyboardVisible: true,
        keyboardHeight: 320,
      })
    ).toBe(286);
  });

  it('never returns a negative offset', () => {
    expect(
      getUtilityFooterOffset({
        bottomInset: 34,
        isKeyboardVisible: true,
        keyboardHeight: 20,
      })
    ).toBe(0);
  });
});
