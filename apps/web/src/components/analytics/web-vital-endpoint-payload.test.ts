import { describe, expect, it } from 'vitest';
import { buildWebVitalEndpointPayload } from './web-vital-endpoint-payload';

const base = { value: 1, id: 'v1', rating: 'poor', navigationType: 'navigate' };

describe('buildWebVitalEndpointPayload', () => {
  it.each([
    'LCP',
    'INP',
    'CLS',
  ])('keeps %s payloads compatible with the legacy schema', (name) => {
    const payload = buildWebVitalEndpointPayload({
      ...base,
      name,
    });

    expect(payload).toMatchObject({
      name,
      value: 1,
      rating: 'poor',
      id: 'v1',
      navigationType: 'navigate',
    });
    expect(payload).not.toHaveProperty('attribution');
    expect(typeof payload.timestamp).toBe('number');
  });
});
