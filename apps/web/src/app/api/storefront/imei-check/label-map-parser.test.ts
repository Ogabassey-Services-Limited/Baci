import { describe, expect, it } from 'vitest';
import { parseProviderLabelMap } from './label-map-parser';

describe('parseProviderLabelMap', () => {
  it('splits br-delimited labels and strips both supported status wrappers', () => {
    expect(
      parseProviderLabelMap(
        'Blacklist: <font color="#008000">Clean</font><br>SIMLock: <span style="color:#ff0000">Locked</span>'
      )
    ).toEqual({
      blacklist: 'Clean',
      simlock: 'Locked',
    });
  });

  it('canonicalizes aliases without trimming values inside object payloads', () => {
    expect(
      parseProviderLabelMap(
        { Finance: '  Clean  ', Model: 'iPhone 17 Pro' },
        { finance: 'finance status' }
      )
    ).toEqual({
      'finance status': 'Clean',
      model: 'iPhone 17 Pro',
    });
  });

  it('keeps the first colon inside a value', () => {
    expect(parseProviderLabelMap('Warranty: Expires: 2027-01-01')).toEqual({
      warranty: 'Expires: 2027-01-01',
    });
  });

  it('returns an empty map for nullish provider payloads', () => {
    expect(parseProviderLabelMap(null)).toEqual({});
    expect(parseProviderLabelMap(undefined)).toEqual({});
  });
});
