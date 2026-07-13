import { describe, expect, it } from 'vitest';
import { createImeiProviderRegistry } from './registry';

describe('createImeiProviderRegistry', () => {
  it('resolves providers by the selected binding name', () => {
    const petrock = { name: 'petrock' as const };
    const sickw = { name: 'sickw' as const };
    const registry = createImeiProviderRegistry({ petrock, sickw });

    expect(registry.get('petrock')).toBe(petrock);
    expect(registry.get('sickw')).toBe(sickw);
  });
});
