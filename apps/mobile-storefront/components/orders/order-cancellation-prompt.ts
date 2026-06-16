import { Alert, type AlertButton, Platform } from 'react-native';

interface OrderCancellationPromptInput {
  onConfirm: (reason?: string) => void;
  reasons: readonly string[];
}

const ANDROID_REASON_PAGE_SIZE = 2;

function buildReasonButtons(
  onConfirm: (reason?: string) => void,
  reasons: readonly string[]
): AlertButton[] {
  return reasons.map((reason) => ({
    onPress: () => onConfirm(reason),
    text: reason,
  }));
}

function presentAndroidReasonPage({
  onConfirm,
  reasons,
  startIndex,
}: OrderCancellationPromptInput & { startIndex: number }) {
  const pageReasons = reasons.slice(
    startIndex,
    startIndex + ANDROID_REASON_PAGE_SIZE
  );
  const nextIndex = startIndex + ANDROID_REASON_PAGE_SIZE;
  const hasMoreReasons = nextIndex < reasons.length;

  Alert.alert(
    'Why are you cancelling?',
    'Choose a cancellation reason. You can go back to keep the order or cancel without a reason.',
    [
      ...buildReasonButtons(onConfirm, pageReasons),
      hasMoreReasons
        ? {
            onPress: () =>
              presentAndroidReasonPage({
                onConfirm,
                reasons,
                startIndex: nextIndex,
              }),
            text: 'More reasons',
          }
        : {
            onPress: () =>
              presentAndroidCancellationPrompt({ onConfirm, reasons }),
            style: 'cancel',
            text: 'Back',
          },
    ]
  );
}

function presentAndroidCancellationPrompt(input: OrderCancellationPromptInput) {
  Alert.alert(
    'Cancel Order?',
    'Tell us why you are cancelling, or cancel without a reason. This cannot be undone.',
    [
      {
        onPress: () =>
          presentAndroidReasonPage({
            ...input,
            startIndex: 0,
          }),
        text: 'Choose a reason',
      },
      {
        onPress: () => input.onConfirm(undefined),
        style: 'destructive',
        text: 'Cancel without a reason',
      },
      { style: 'cancel', text: 'Keep Order' },
    ]
  );
}

/**
 * Presents the customer-facing "Cancel Order" confirmation.
 *
 * iOS can show every reason in a single native alert. Android native alerts are
 * limited to three buttons, so Android uses a paged reason picker while keeping
 * the no-reason confirm and keep-order dismissal visible on the first prompt.
 * Selecting a reason — or the no-reason confirm — invokes `onConfirm`;
 * dismissing does nothing.
 */
export function presentOrderCancellationPrompt({
  onConfirm,
  reasons,
}: OrderCancellationPromptInput) {
  if (Platform.OS === 'android') {
    presentAndroidCancellationPrompt({ onConfirm, reasons });
    return;
  }

  Alert.alert(
    'Cancel Order?',
    'Tell us why you are cancelling, or cancel without a reason. This cannot be undone.',
    [
      ...buildReasonButtons(onConfirm, reasons),
      {
        onPress: () => onConfirm(undefined),
        style: 'destructive',
        text: 'Cancel without a reason',
      },
      { style: 'cancel', text: 'Keep Order' },
    ]
  );
}
