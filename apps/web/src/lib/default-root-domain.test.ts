import { describe, expect, it } from 'vitest';
import { DEFAULT_ROOT_DOMAIN } from './default-root-domain';

describe('DEFAULT_ROOT_DOMAIN', () => {
  it('matches the production platform apex fallback', () => {
    expect(DEFAULT_ROOT_DOMAIN).toBe('usebaci.com');
  });
});
