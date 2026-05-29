import { Alert, Platform, ToastAndroid } from 'react-native';

export function showCartToast(
  message: string,
  type: 'error' | 'success' = 'error'
) {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
    return;
  }

  Alert.alert(
    type === 'error' ? 'Stock Error' : 'Success',
    message,
    [{ text: 'OK' }],
    {
      cancelable: true,
    }
  );
}
