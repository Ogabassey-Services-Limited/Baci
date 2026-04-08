interface UtilityFooterOffsetParams {
  bottomInset: number;
  isKeyboardVisible: boolean;
  keyboardHeight: number;
}

export function getUtilityFooterOffset({
  bottomInset,
  isKeyboardVisible,
  keyboardHeight,
}: UtilityFooterOffsetParams) {
  if (!isKeyboardVisible) {
    return 0;
  }

  return Math.max(keyboardHeight - bottomInset, 0);
}
