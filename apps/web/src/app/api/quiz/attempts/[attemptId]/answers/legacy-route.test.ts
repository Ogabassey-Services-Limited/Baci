import { describe, expect, it } from 'vitest';
import { postLegacyQuizAnswer } from './legacy-route';

describe('legacy quiz answer route', () => {
  it('exports the legacy handler used by the version dispatcher', () => {
    expect(postLegacyQuizAnswer).toBeTypeOf('function');
  });
});
