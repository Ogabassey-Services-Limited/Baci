import { createHash } from 'node:crypto';

export function createStableAnalyticsClientId(eventId: string): string {
  const digest = createHash('sha256').update(eventId).digest();
  const high = digest.readUInt32BE(0) || 1;
  const low = digest.readUInt32BE(4) || 1;
  return `${high}.${low}`;
}
