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
  if (!isKeyboardVisible || keyboardHeight <= 0) {
    return 0;
  }

  return Math.max(keyboardHeight - Math.max(bottomInset, 0), 0);
}
