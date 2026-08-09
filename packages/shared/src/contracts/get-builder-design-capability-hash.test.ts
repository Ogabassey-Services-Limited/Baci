import { describe, expect, it } from 'vitest';
import { builderDesignCapabilities } from './builder-design-capabilities';
import { getBuilderDesignCapabilityHash } from './get-builder-design-capability-hash';

describe('getBuilderDesignCapabilityHash', () => {
  it('returns the canonical lowercase SHA-256 digest without a prefix', () => {
    const hash = getBuilderDesignCapabilityHash({ b: 2, a: 1 });

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe(
      '43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777'
    );
  });

  it('is stable for semantically identical capability data across calls', () => {
    const reordered = {
      components: builderDesignCapabilities.components,
      refusalCodes: builderDesignCapabilities.refusalCodes,
      themeTokenKeys: builderDesignCapabilities.themeTokenKeys,
      capabilityVersion: builderDesignCapabilities.capabilityVersion,
      version: builderDesignCapabilities.version,
    };

    expect(getBuilderDesignCapabilityHash(builderDesignCapabilities)).toBe(
      getBuilderDesignCapabilityHash(reordered)
    );
  });

  it('changes when a capability limit, token, or refusal rule changes', () => {
    const base = getBuilderDesignCapabilityHash(builderDesignCapabilities);
    const changedLimit = structuredClone(builderDesignCapabilities);
    changedLimit.components[0].props.title = {
      maximumLength: 121,
      type: 'string',
    };
    const changedToken = structuredClone(builderDesignCapabilities);
    changedToken.themeTokenKeys = [...changedToken.themeTokenKeys, 'surface'];
    const changedRefusal = structuredClone(builderDesignCapabilities);
    changedRefusal.refusalCodes['unsafe-code'] = 'Changed boundary';

    expect(getBuilderDesignCapabilityHash(changedLimit)).not.toBe(base);
    expect(getBuilderDesignCapabilityHash(changedToken)).not.toBe(base);
    expect(getBuilderDesignCapabilityHash(changedRefusal)).not.toBe(base);
  });

  it('distinguishes refusal text that differs only by an astral Unicode character', () => {
    expect(getBuilderDesignCapabilityHash({ refusal: 'Blocked 😀' })).not.toBe(
      getBuilderDesignCapabilityHash({ refusal: 'Blocked 😁' })
    );
  });

  it('preserves recursive canonical key order while excluding capabilityHash', () => {
    expect(
      getBuilderDesignCapabilityHash({
        nested: { beta: 2, alpha: 1 },
        capabilityHash: 'stale',
      })
    ).toBe(getBuilderDesignCapabilityHash({ nested: { alpha: 1, beta: 2 } }));
  });

  it('orders Unicode keys by deterministic UTF-16 code units', () => {
    expect(getBuilderDesignCapabilityHash({ ä: 2, z: 1 })).toBe(
      '7832a5d6150a56da1a4f0c8fa00c26a7350389b0fc8696707cd2abbbd32be0c1'
    );
  });
});
