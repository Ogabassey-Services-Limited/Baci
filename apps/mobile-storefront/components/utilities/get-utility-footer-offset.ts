interface UtilityFooterOffsetParams {
  bottomInset: number;
  isKeyboardVisible: boolean;
  keyboardHeight: number;
}

// The utility forms are wrapped in `AppKeyboardContainer` (a
// react-native-keyboard-controller KeyboardAvoidingView, behavior="padding"),
// which already lifts the form — and therefore the absolute pay footer's
// containing block — above the keyboard. Applying a manual keyboard offset on
// top of that double-lifted the footer, so it floated into the middle of the
// form while typing. The footer must stay pinned to the bottom of the avoided
// area, so this always returns 0. Params kept for call-site compatibility.
export function getUtilityFooterOffset(_params: UtilityFooterOffsetParams) {
  return 0;
}
