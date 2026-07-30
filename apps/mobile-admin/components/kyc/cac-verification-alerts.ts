import { Alert } from 'react-native';
import { NetworkError } from '@/lib/api-client';

export function showCacVerificationError(error: unknown): void {
  if (error instanceof NetworkError && error.statusCode === 429) {
    Alert.alert(
      'Rate Limited',
      'Rate limit exceeded. Please wait a minute and try again.'
    );
    return;
  }

  const message =
    error instanceof Error ? error.message : 'An unexpected error occurred';
  Alert.alert('Error', message);
}
