import * as Crypto from 'expo-crypto';
import type { QuizFingerprintSignals } from './quiz-fingerprint-types';

type QuizFingerprintHasher = (value: string) => Promise<string>;

export async function createQuizFingerprint(
  signals: QuizFingerprintSignals,
  hasher: QuizFingerprintHasher = (value) =>
    Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value)
): Promise<string | null> {
  const installationId = signals.installationId?.trim();
  const deviceName = signals.deviceName?.trim();
  const osName = signals.osName?.trim();

  if (!installationId || !deviceName || !osName) {
    return null;
  }

  return await hasher(JSON.stringify([installationId, deviceName, osName]));
}
