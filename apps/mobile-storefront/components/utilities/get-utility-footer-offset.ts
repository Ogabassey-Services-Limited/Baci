interface UtilityFooterOffsetParams {
  bottomInset: number;
  isKeyboardVisible: boolean;
  keyboardHeight: number;
}

const KEYBOARD_FOOTER_GAP = 8;

export function getUtilityFooterOffset({
  isKeyboardVisible,
  keyboardHeight,
}: UtilityFooterOffsetParams) {
  if (!isKeyboardVisible) {
    return 0;
  }

  return Math.max(keyboardHeight + KEYBOARD_FOOTER_GAP, 0);
}
