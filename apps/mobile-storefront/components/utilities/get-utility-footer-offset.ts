interface UtilityFooterOffsetParams {
  bottomInset: number;
  isKeyboardVisible: boolean;
  keyboardHeight: number;
}

export function getUtilityFooterOffset(_params: UtilityFooterOffsetParams) {
  // Utility payment CTAs stay anchored to the screen bottom. The keyboard
  // overlays them instead of lifting them into the form content.
  return 0;
}
