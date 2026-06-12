import { describe, expect, it } from 'vitest';
import { getRequestLocale } from './request-locale';

describe('getRequestLocale', () => {
  it('returns the canonical first accept-language locale', () => {
    const headers = new Headers({
      'accept-language': 'en-ng;q=0.8,en-US;q=0.7',
    });

    expect(getRequestLocale(headers)).toBe('en-NG');
  });

  it('returns a single locale without quality values', () => {
    expect(getRequestLocale(new Headers({ 'accept-language': 'en-US' }))).toBe(
      'en-US'
    );
  });

  it('returns the first locale when multiple locales omit quality values', () => {
    expect(
      getRequestLocale(new Headers({ 'accept-language': 'en-US,fr-FR,de-DE' }))
    ).toBe('en-US');
  });

  it('returns undefined for missing accept-language header', () => {
    expect(getRequestLocale(new Headers())).toBeUndefined();
  });

  it('returns undefined for invalid accept-language value', () => {
    expect(
      getRequestLocale(new Headers({ 'accept-language': 'not a locale' }))
    ).toBeUndefined();
  });

  it('returns undefined for blank or quality-only accept-language values', () => {
    expect(
      getRequestLocale(new Headers({ 'accept-language': '' }))
    ).toBeUndefined();
    expect(
      getRequestLocale(new Headers({ 'accept-language': '   ' }))
    ).toBeUndefined();
    expect(
      getRequestLocale(new Headers({ 'accept-language': ';q=0.8' }))
    ).toBeUndefined();
  });
});
