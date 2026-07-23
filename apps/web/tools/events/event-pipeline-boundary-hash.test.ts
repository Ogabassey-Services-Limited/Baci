import { describe, expect, it } from 'vitest';
import { frozenRouteHashFinding } from './event-pipeline-boundary-hash';

describe('frozenRouteHashFinding', () => {
  it('reports drift and accepts the exact digest', () => {
    const finding = frozenRouteHashFinding('route.ts', 'drift', 'expected');
    expect(finding).toMatch(/^route\.ts: frozen route hash /);
    const digest = finding?.split(' ').at(-1) ?? '';
    expect(frozenRouteHashFinding('route.ts', 'drift', digest)).toBeUndefined();
  });
});
