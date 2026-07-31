import { describe, expect, it } from 'vitest';
import { loadBuilderPayload } from './builder-load-payload';

describe('builder load payload module', () => {
  it('exports the loader covered by the route GET suite', () => {
    expect(loadBuilderPayload).toEqual(expect.any(Function));
  });
});
