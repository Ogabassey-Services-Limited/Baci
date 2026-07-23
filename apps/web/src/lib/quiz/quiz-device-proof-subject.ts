import { createHash } from 'node:crypto';

export function buildQuizDeviceProofSubject(
  scopeId: string,
  deviceHash: string
): string {
  const digest = createHash('sha256')
    .update(`${scopeId}:${deviceHash}`)
    .digest('hex');
  return `device:${digest}`;
}
