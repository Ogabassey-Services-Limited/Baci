import { Alert } from 'react-native';
import { NetworkError } from '@/lib/api-client';

export function showBvnVerificationError(error: unknown) {
  if (error instanceof NetworkError && error.statusCode === 429) {
    Alert.alert(
      'Rate Limited',
      'Rate limit exceeded. Please wait a minute and try again.'
    );
    return;
  }

  if (
    error instanceof NetworkError &&
    error.statusCode === 503 &&
    error.message.includes('Monnify account is restricted')
  ) {
    Alert.alert(
      'BVN Verification Unavailable',
      'Monnify rejected the verification request because the configured account is restricted. This needs to be fixed on the Monnify account, not in the form.'
    );
    return;
  }

  if (
    error instanceof NetworkError &&
    error.statusCode === 503 &&
    error.message.includes('BVN verification is not configured')
  ) {
    Alert.alert(
      'BVN Verification Unavailable',
      'BVN verification is not configured on this local environment yet. Add Monnify credentials or test against an environment where Monnify is configured.'
    );
    return;
  }

  if (
    error instanceof NetworkError &&
    !error.isOffline &&
    !error.isTimeout
  ) {
    Alert.alert('Verification Error', error.message);
    return;
  }

  console.warn(
    'BVN verification error:',
    error instanceof Error ? error.message : 'Unknown error'
  );
  Alert.alert(
    'Verification Error',
    'Unable to verify BVN. Please check your connection and try again.'
  );
}
