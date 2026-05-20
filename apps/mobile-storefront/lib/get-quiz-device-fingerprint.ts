import * as Application from 'expo-application';
import { Platform } from 'react-native';
import { createQuizFingerprint } from './quiz-fingerprint';

// Exceptional platform-specific primitive: Expo exposes a synchronous Android
// ID and async iOS vendor ID, so this wrapper centralizes the Platform.OS split.
async function getNativeInstallationId(): Promise<string | null> {
  if (Platform.OS === 'android') {
    return Application.getAndroidId();
  }

  if (Platform.OS === 'ios') {
    return await Application.getIosIdForVendorAsync();
  }

  return null;
}

export async function getQuizDeviceFingerprint(): Promise<string | null> {
  const installationId = await getNativeInstallationId();
  const deviceName = Application.applicationName ?? '';

  return createQuizFingerprint({
    installationId,
    deviceName,
    osName: Platform.OS,
  });
}
