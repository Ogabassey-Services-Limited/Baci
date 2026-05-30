import { Alert } from 'react-native';
import type { createLogger } from '@/lib/logger';

type LoginLogger = Pick<ReturnType<typeof createLogger>, 'error' | 'info'>;

interface LoginSocialSignInInput {
  errorMessage: string;
  loading: (value: boolean) => void;
  log: LoginLogger;
  provider: 'Apple' | 'Google';
  signIn: () => Promise<{ error?: string; success: boolean }>;
}

export async function runLoginSocialSignIn({
  errorMessage,
  loading,
  log,
  provider,
  signIn,
}: LoginSocialSignInInput) {
  loading(true);
  try {
    const result = await signIn();
    if (result.success) {
      log.info(`${provider} sign-in flow initiated successfully`);
    } else if (result.error !== 'Sign in was cancelled') {
      Alert.alert('Error', result.error || errorMessage);
    }
  } catch (error) {
    log.error(`Unexpected error in handle${provider}SignIn:`, error);
    Alert.alert('Error', `An unexpected error occurred during ${provider} sign-in`);
  } finally {
    loading(false);
  }
}
