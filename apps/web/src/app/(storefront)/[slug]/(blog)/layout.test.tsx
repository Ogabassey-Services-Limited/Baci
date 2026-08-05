import { describe, expect, it } from 'vitest';
import { unstable_instant } from './layout';

describe('storefront blog route group', () => {
  it('disables instant static-shell validation when the parent resolves request-bound tenant routing', () => {
    expect(unstable_instant).toBe(false);
  });
});
