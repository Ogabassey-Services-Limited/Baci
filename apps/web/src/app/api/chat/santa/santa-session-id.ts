import crypto from 'node:crypto';

export function generateSessionId(ip: string): string {
  return crypto
    .createHash('sha256')
    .update(`${ip}-santa-2024`)
    .digest('hex')
    .slice(0, 16);
}
