import { constantTimeEqual } from '@/lib/constant-time-equal';

export function hasValidCronSecret(
  headers: Headers,
  expectedSecret: string | null | undefined
) {
  if (!expectedSecret) {
    return false;
  }

  const authHeader = headers.get('authorization');
  const bearerMatch = authHeader?.match(/^bearer\s+(.+)$/i);
  const bearerToken = bearerMatch?.[1]?.trim() || null;
  const legacyHeader = headers.get('x-cron-secret');
  const candidateSecret = bearerToken || legacyHeader;

  if (!candidateSecret) {
    return false;
  }

  return constantTimeEqual(candidateSecret, expectedSecret);
}
