import { describe, expect, it } from 'vitest';
import {
  extractKudaTransactionId,
  extractKudaVoucherPin,
  normalizeKudaString,
} from '@/lib/kuda-voucher-token';

const MAX_TOKEN_EXTRACTION_DEPTH = 8;

function buildNestedTokenContainer(depth: number, terminalValue: unknown) {
  let container: unknown = terminalValue;

  for (let index = 0; index < depth; index += 1) {
    container = { Value: container };
  }

  return container;
}

describe('normalizeKudaString', () => {
  it('trims strings and ignores empty values', () => {
    expect(normalizeKudaString('  1234-5678  ')).toBe('1234-5678');
    expect(normalizeKudaString('   ')).toBeUndefined();
  });

  it('normalizes finite numbers', () => {
    expect(normalizeKudaString(123456)).toBe('123456');
    expect(normalizeKudaString(Number.NaN)).toBeUndefined();
  });
});

describe('extractKudaVoucherPin', () => {
  it('does not treat scalar root payloads as voucher tokens', () => {
    expect(extractKudaVoucherPin('Pending')).toBeUndefined();
    expect(extractKudaVoucherPin(1)).toBeUndefined();
    expect(extractKudaVoucherPin('0283-6213-2450-8322-0153')).toBeUndefined();
  });

  it('keeps the existing scalar field precedence', () => {
    expect(
      extractKudaVoucherPin({
        Pin: 'UPPER-PIN-123',
        pin: 'LOWER-PIN-123',
      })
    ).toBe('LOWER-PIN-123');
  });

  it('extracts EKEDC tokens from nested Kuda pin objects', () => {
    expect(
      extractKudaVoucherPin({
        Pin: {
          Number: ' 0283-6213-2450-8322-0153 ',
          Units: '29.4',
        },
      })
    ).toBe('0283-6213-2450-8322-0153');
  });

  it('extracts tokens from token container arrays', () => {
    expect(
      extractKudaVoucherPin({
        Tokens: [
          { Units: '12.8' },
          { TokenCode: ' 1111-2222-3333-4444-5555 ' },
        ],
      })
    ).toBe('1111-2222-3333-4444-5555');
  });

  it('ignores unrelated object fields', () => {
    expect(
      extractKudaVoucherPin({
        Reference: 'TXN-123',
        Customer: {
          Number: '43901766923',
        },
      })
    ).toBeUndefined();
  });

  it('stops safely on circular token payloads', () => {
    const payload: Record<string, unknown> = {};
    payload.Pin = payload;

    expect(extractKudaVoucherPin(payload)).toBeUndefined();
  });

  it('stops before returning tokens beyond the extraction depth limit', () => {
    // Use the public entrypoint so the root payload is seeded in the visited
    // set before the private extractor walks the nested token containers.
    const payload = {
      Pin: buildNestedTokenContainer(
        MAX_TOKEN_EXTRACTION_DEPTH,
        'TOKEN-BEYOND-LIMIT'
      ),
    };

    expect(
      extractKudaVoucherPin({
        Pin: buildNestedTokenContainer(
          MAX_TOKEN_EXTRACTION_DEPTH - 2,
          'TOKEN-WITHIN-LIMIT'
        ),
      })
    ).toBe('TOKEN-WITHIN-LIMIT');
    expect(extractKudaVoucherPin(payload)).toBeUndefined();
  });
});

describe('extractKudaTransactionId', () => {
  it('extracts transaction ids from Kuda reference fields', () => {
    expect(extractKudaTransactionId({ reference: ' REF-LOWER ' })).toBe(
      'REF-LOWER'
    );
    expect(extractKudaTransactionId({ Reference: ' REF-UPPER ' })).toBe(
      'REF-UPPER'
    );
  });

  it('uses the fallback when Kuda does not return a reference', () => {
    expect(
      extractKudaTransactionId({ status: 'pending' }, ' REQUEST-REF ')
    ).toBe('REQUEST-REF');
    expect(extractKudaTransactionId('Pending', ' REQUEST-REF ')).toBe(
      'REQUEST-REF'
    );
  });
});
