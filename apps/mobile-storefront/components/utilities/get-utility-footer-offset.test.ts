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

  // Regression: AppKeyboardContainer (KeyboardAvoidingView) already lifts the
  // form above the keyboard. The footer must NOT add its own keyboard offset, or
  // it double-lifts and floats into the middle of the form while typing.
  it('returns zero when the keyboard is visible (KeyboardAvoidingView owns the lift)', () => {
    expect(
      getUtilityFooterOffset({
        bottomInset: 34,
        isKeyboardVisible: true,
        keyboardHeight: 320,
      })
    ).toBe(0);
  });

  it('returns zero for a large keyboard height (no manual lift, ever)', () => {
    expect(
      getUtilityFooterOffset({
        bottomInset: 0,
        isKeyboardVisible: true,
        keyboardHeight: 420,
      })
    ).toBe(0);
  });
});
