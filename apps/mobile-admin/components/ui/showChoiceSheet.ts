import { ActionSheetIOS, Alert, Platform } from 'react-native';

interface ChoiceOption<TValue extends string> {
  label: string;
  value: TValue;
}

interface ShowChoiceSheetOptions<TValue extends string> {
  cancelText?: string;
  message?: string;
  options: ChoiceOption<TValue>[];
  title: string;
}

export function showChoiceSheet<TValue extends string>({
  cancelText = 'Cancel',
  message,
  options,
  title,
}: ShowChoiceSheetOptions<TValue>): Promise<TValue | null> {
  // iOS gets the native action sheet; other platforms fall back to Alert.
  if (Platform.OS === 'ios') {
    return new Promise((resolve) => {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          cancelButtonIndex: options.length,
          message,
          options: [...options.map((option) => option.label), cancelText],
          title,
        },
        (buttonIndex) => {
          resolve(options[buttonIndex]?.value ?? null);
        }
      );
    });
  }

  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        ...options.map((option) => ({
          text: option.label,
          onPress: () => resolve(option.value),
        })),
        {
          style: 'cancel' as const,
          text: cancelText,
          onPress: () => resolve(null),
        },
      ],
      {
        cancelable: true,
        onDismiss: () => resolve(null),
      }
    );
  });
}
