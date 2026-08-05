import { describe, expect, it } from 'vitest';
import { postLegacyQuizStart } from './legacy-route';

describe('legacy quiz start route', () => {
  it('exports the legacy handler used by the version dispatcher', () => {
    expect(postLegacyQuizStart).toBeTypeOf('function');
  });
});
