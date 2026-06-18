import { describe, expect, it } from 'vitest';
import { buildWebVitalEndpointPayload } from './web-vital-endpoint-payload';

const base = { value: 1, id: 'v1', rating: 'poor', navigationType: 'navigate' };

describe('buildWebVitalEndpointPayload', () => {
  it.each([
    'LCP',
    'INP',
    'CLS',
  ])('keeps %s payloads compatible with the legacy schema', (name) => {
    const before = Date.now();
    const payload = buildWebVitalEndpointPayload({
      ...base,
      name,
    });
    const after = Date.now();

    expect(payload).toMatchObject({
      name,
      value: 1,
      rating: 'poor',
      id: 'v1',
      navigationType: 'navigate',
    });
    expect(payload).not.toHaveProperty('attribution');
    expect(typeof payload.timestamp).toBe('number');
    expect(payload.timestamp).toBeGreaterThanOrEqual(before);
    expect(payload.timestamp).toBeLessThanOrEqual(after);
  });
});
