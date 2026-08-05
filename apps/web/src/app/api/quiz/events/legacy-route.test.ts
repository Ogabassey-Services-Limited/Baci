import { describe, expect, it } from 'vitest';
import { getLegacyQuizEvents } from './legacy-route';

describe('legacy quiz events route', () => {
  it('exports the legacy handler used by the version dispatcher', () => {
    expect(getLegacyQuizEvents).toBeTypeOf('function');
  });
});
