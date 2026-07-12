import { describe, expect, it } from 'vitest';
import { parseDomainEventV1 } from './event-contract';

describe('parseDomainEventV1', () => {
  it('parses a valid versioned domain event', () => {
    const result = parseDomainEventV1({
      data: {},
      domain_event_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a234',
      event_name: 'catalog.product.updated.v1',
      idempotency_key: 'catalog:product-1:updated',
      metadata: { environment: 'test' },
      occurred_at: '2026-07-12T12:00:00.000Z',
      producer: 'database',
      schema_version: 1,
      source: { operation: 'UPDATE', schema: 'public', table: 'products' },
      subject: { id: 'product-1', type: 'product' },
      trust_level: 'database',
    });

    expect(result).toMatchObject({
      event: {
        event_name: 'catalog.product.updated.v1',
        subject: { id: 'product-1', type: 'product' },
      },
      success: true,
    });
  });

  it('returns safe issue codes without echoing a poison payload', () => {
    expect(parseDomainEventV1({ token: 'do-not-log' })).toEqual({
      issues: expect.any(Array),
      success: false,
    });
    expect(
      JSON.stringify(parseDomainEventV1({ token: 'do-not-log' }))
    ).not.toContain('do-not-log');
  });
});
