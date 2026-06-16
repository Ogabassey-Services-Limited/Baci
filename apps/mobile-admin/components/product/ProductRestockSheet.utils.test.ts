import { describe, expect, it } from 'vitest';
import {
  buildRestockUnits,
  findInvalidImeis,
  parseRestockIdentifiers,
} from './ProductRestockSheet.utils';

describe('ProductRestockSheet utils', () => {
  it('parses comma and newline separated identifiers', () => {
    expect(parseRestockIdentifiers(' 123 ,\n456\n\n789 ')).toEqual([
      '123',
      '456',
      '789',
    ]);
  });

  it('drops blank comma and newline segments when parsing identifiers', () => {
    expect(parseRestockIdentifiers(' SN-1, ,\nSN-2\n  ')).toEqual([
      'SN-1',
      'SN-2',
    ]);
  });

  it('builds IMEI restock payloads without empty optional notes', () => {
    expect(
      buildRestockUnits({
        identifiers: ['123456789012345'],
        mode: 'imei',
        notes: '   ',
        source: 'merchant_stock',
      })
    ).toEqual([{ imei: '123456789012345', source: 'merchant_stock' }]);
  });

  it('detects malformed IMEIs', () => {
    expect(findInvalidImeis(['123456789012345', 'abc', '123'])).toEqual([
      'abc',
      '123',
    ]);
  });

  it('builds typed restock payloads with trimmed optional notes', () => {
    expect(
      buildRestockUnits({
        identifiers: ['SN-1'],
        mode: 'serial',
        notes: '  supplier batch  ',
        source: 'vendor_sourced',
      })
    ).toEqual([
      { serial: 'SN-1', notes: 'supplier batch', source: 'vendor_sourced' },
    ]);
  });
});
