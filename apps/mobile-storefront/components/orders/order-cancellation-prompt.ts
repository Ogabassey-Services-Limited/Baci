import { Alert, type AlertButton } from 'react-native';

interface OrderCancellationPromptInput {
  onConfirm: (reason?: string) => void;
  reasons: readonly string[];
}

/**
 * Presents the customer-facing "Cancel Order" confirmation.
 *
 * Each cancellation reason is offered as its own button, plus a destructive
 * "Cancel without a reason" escape hatch (reason is optional/skippable) and a
 * `cancel`-styled "Keep Order" dismissal. Selecting a reason — or the no-reason
 * confirm — invokes `onConfirm`; dismissing does nothing.
 */
export function presentOrderCancellationPrompt({
  onConfirm,
  reasons,
}: OrderCancellationPromptInput) {
  const reasonButtons: AlertButton[] = reasons.map((reason) => ({
    onPress: () => onConfirm(reason),
    text: reason,
  }));

  Alert.alert(
    'Cancel Order?',
    'Tell us why you are cancelling, or cancel without a reason. This cannot be undone.',
    [
      ...reasonButtons,
      {
        onPress: () => onConfirm(undefined),
        style: 'destructive',
        text: 'Cancel without a reason',
      },
      { style: 'cancel', text: 'Keep Order' },
    ]
  );
}
