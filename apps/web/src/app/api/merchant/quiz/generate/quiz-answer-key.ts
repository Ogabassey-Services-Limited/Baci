import crypto from 'node:crypto';

export function hashAnswerKey(answer: string): string {
  return crypto
    .createHash('sha256')
    .update(answer.trim().toLowerCase())
    .digest('hex');
}
