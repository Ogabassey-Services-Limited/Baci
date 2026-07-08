import { describe, expect, it } from 'vitest';
import { cleanUsername, isValidUsername } from './username-normalize';

describe('cleanUsername', () => {
  it('strips zero-width characters and trims', () => {
    expect(cleanUsername('  co​de‍  ')).toBe('code');
  });

  it('NFKC-normalizes full-width look-alikes to ASCII', () => {
    // Full-width "ｇａｍｅｒ" normalizes to ASCII "gamer".
    expect(cleanUsername('ｇａｍｅｒ')).toBe('gamer');
  });

  it('keeps the chosen casing', () => {
    expect(cleanUsername('OgaFan_7')).toBe('OgaFan_7');
  });
});

describe('isValidUsername', () => {
  it('accepts valid usernames', () => {
    for (const name of [
      'abc',
      'oga_fan',
      'player.1',
      'a1b2c3',
      'CoolGamer99',
    ]) {
      expect(isValidUsername(name)).toBe(true);
    }
  });

  it('rejects too short / too long', () => {
    expect(isValidUsername('ab')).toBe(false);
    expect(isValidUsername('a'.repeat(21))).toBe(false);
  });

  it('rejects leading/trailing separators and consecutive separators', () => {
    expect(isValidUsername('_abc')).toBe(false);
    expect(isValidUsername('abc_')).toBe(false);
    expect(isValidUsername('a__b')).toBe(false);
    expect(isValidUsername('a._b')).toBe(false);
  });

  it('rejects non-ASCII homoglyphs (Cyrillic "о")', () => {
    // The ASCII-only charset blocks look-alike impersonation outright.
    expect(isValidUsername('cоde')).toBe(false);
  });

  it('rejects spaces and symbols', () => {
    expect(isValidUsername('oga fan')).toBe(false);
    expect(isValidUsername('oga!fan')).toBe(false);
  });
});
