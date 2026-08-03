import { describe, expect, it } from 'vitest';
import { generateSessionId } from './santa-session-id';

describe('generateSessionId', () => {
  it('generates a stable privacy-preserving session id', () => {
    expect(generateSessionId('127.0.0.1')).toBe(generateSessionId('127.0.0.1'));
    expect(generateSessionId('127.0.0.1')).toHaveLength(16);
    expect(generateSessionId('127.0.0.1')).not.toBe(
      generateSessionId('127.0.0.2')
    );
  });
});
