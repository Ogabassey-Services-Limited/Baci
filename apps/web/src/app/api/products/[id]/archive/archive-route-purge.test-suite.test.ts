import { describe, expect, it } from 'vitest';
import { defineArchiveRoutePurgeSuite } from './archive-route-purge.test-suite';

describe('archive route purge test suite', () => {
  it('exports the focused suite registrar', () => {
    expect(defineArchiveRoutePurgeSuite).toEqual(expect.any(Function));
  });
});
