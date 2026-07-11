import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hashAnswerKey } from './quiz-answer-key';

describe('hashAnswerKey', () => {
  it('normalizes case and whitespace before hashing', () => {
    const expected = crypto.createHash('sha256').update('b').digest('hex');

    expect(hashAnswerKey('  B  ')).toBe(expected);
    expect(hashAnswerKey('b')).toBe(expected);
  });
});
