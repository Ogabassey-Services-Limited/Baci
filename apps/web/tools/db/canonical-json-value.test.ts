import { describe, expect, it } from 'vitest';
import { canonicalJsonValue } from './canonical-json-value';

describe('canonicalJsonValue', () => {
  it('sorts object keys recursively and preserves array order', () => {
    expect(
      canonicalJsonValue({
        z: 1,
        nested: { y: 2, a: 1 },
        rows: [{ z: 2, a: 1 }, { a: 3 }],
      })
    ).toBe('{"nested":{"a":1,"y":2},"rows":[{"a":1,"z":2},{"a":3}],"z":1}\n');
  });

  it('sorts integer-like and prototype-looking keys lexically', () => {
    expect(
      canonicalJsonValue(
        JSON.parse('{"2":"two","10":"ten","__proto__":{"safe":true}}')
      )
    ).toBe('{"10":"ten","2":"two","__proto__":{"safe":true}}\n');
    expect((Object.prototype as { safe?: boolean }).safe).toBeUndefined();
  });

  it('accepts multiline JSON strings without applying fixture policy', () => {
    expect(
      canonicalJsonValue({
        body: 'BEGIN\n  RETURN NEW;\nEND',
        name: 'register_push_token_rpc',
      })
    ).toBe(
      '{"body":"BEGIN\\n  RETURN NEW;\\nEND","name":"register_push_token_rpc"}\n'
    );
  });

  it('rejects non-JSON primitives and object shapes', () => {
    expect(() => canonicalJsonValue({ missing: undefined })).toThrow(/JSON/i);
    expect(() => canonicalJsonValue({ value: Number.NaN })).toThrow(/JSON/i);
    expect(() => canonicalJsonValue(new Date())).toThrow(/JSON/i);
    expect(() => canonicalJsonValue({ value: BigInt(1) })).toThrow(/JSON/i);
  });

  it('rejects sparse, accessor, custom-property, symbol, and cyclic values', () => {
    const sparse = new Array<unknown>(2);
    sparse[1] = 'present';
    const accessor: unknown[] = [];
    Object.defineProperty(accessor, '0', {
      enumerable: true,
      get: () => 'computed',
    });
    const custom = ['present'] as unknown[] & { extra?: string };
    custom.extra = 'extra';
    const symbolic = ['present'];
    Object.defineProperty(symbolic, Symbol('hidden'), { value: 'hidden' });
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;

    for (const value of [sparse, accessor, custom, symbolic, cyclic]) {
      expect(() => canonicalJsonValue(value)).toThrow(/JSON/i);
    }
  });

  it('runs the supplied string policy for keys and values', () => {
    const policy = (value: string) => {
      if (value === 'blocked') throw new Error('blocked string');
    };

    expect(() =>
      canonicalJsonValue({ safe: 'blocked' }, { assertString: policy })
    ).toThrow('blocked string');
    expect(() =>
      canonicalJsonValue({ blocked: 'safe' }, { assertString: policy })
    ).toThrow('blocked string');
  });
});
