import { describe, expect, it } from 'vitest';
import {
  matchesPetrockModelScope,
  normalizePetrockDeviceModel,
  parsePetrockModelScope,
} from './petrock-device-model';

describe('Petrock remediation device model matching', () => {
  it('normalizes an Apple generation string to an iPhone series', () => {
    expect(
      normalizePetrockDeviceModel('IPHONE 17 PRO MAX (A3525)', 'IPHONE18,2')
    ).toMatchObject({ family: 'iphone', series: 17 });
  });

  it('matches ranges and fails closed on an ambiguous model', () => {
    expect(
      matchesPetrockModelScope(
        { canonical: 'iphone-17', family: 'iphone', series: 17 },
        { kind: 'range', max: 17, min: 16 }
      )
    ).toBe(true);
    expect(
      matchesPetrockModelScope(
        { canonical: '', family: 'unknown', series: null },
        { family: 'iphone', kind: 'generic' }
      )
    ).toBe(false);
  });

  it('validates persisted model scopes at the database boundary', () => {
    expect(
      parsePetrockModelScope({
        family: 'iphone',
        kind: 'range',
        max: 17,
        min: 16,
      })
    ).toEqual({ family: 'iphone', kind: 'range', max: 17, min: 16 });
    expect(
      parsePetrockModelScope({ kind: 'set', models: ['iphone-17'] })
    ).toEqual({ kind: 'set', models: ['iphone-17'] });
  });

  it.each([
    null,
    { kind: 'range', max: 15, min: 17 },
    { kind: 'range', max: '17', min: 16 },
    { kind: 'set', models: [] },
    { kind: 'set', models: [''] },
    { kind: 'unknown' },
  ])('rejects a malformed persisted model scope', (scope) => {
    expect(parsePetrockModelScope(scope)).toBeNull();
  });
});
