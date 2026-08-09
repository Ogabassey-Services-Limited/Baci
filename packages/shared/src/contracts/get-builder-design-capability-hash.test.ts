import { describe, expect, it } from 'vitest';
import { builderDesignCapabilities } from './builder-design-capabilities';
import { getBuilderDesignCapabilityHash } from './get-builder-design-capability-hash';

describe('getBuilderDesignCapabilityHash', () => {
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
});
