import { describe, expect, it } from 'vitest';
import { domainEventV1Schema } from './domain-event';

const validEvent = {
  data: { product_id: 'product-1' },
  domain_event_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a234',
  event_name: 'catalog.product.updated.v1',
  idempotency_key: 'catalog.product.updated:product-1:42',
  merchant_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
  metadata: { environment: 'test' },
  occurred_at: '2026-07-12T12:00:00.000Z',
  producer: 'database',
  schema_version: 1,
  source: { operation: 'UPDATE', schema: 'public', table: 'products' },
  subject: { id: 'product-1', type: 'product' },
  trust_level: 'database',
} as const;

describe('domainEventV1Schema', () => {
  it('accepts a versioned, allowlisted event envelope', () => {
    expect(domainEventV1Schema.parse(validEvent)).toEqual(validEvent);
  });

  it('rejects unversioned event names', () => {
    const result = domainEventV1Schema.safeParse({
      ...validEvent,
      event_name: 'catalog.product.updated',
    });

    expect(result.success).toBe(false);
  });

  it('rejects caller-controlled extra properties', () => {
    const result = domainEventV1Schema.safeParse({
      ...validEvent,
      destinations: ['facebook'],
    });

    expect(result.success).toBe(false);
  });

  it('rejects unsafe request correlation metadata', () => {
    expect(
      domainEventV1Schema.safeParse({
        ...validEvent,
        metadata: { environment: 'test', request_id: 'email@example.com' },
      }).success
    ).toBe(false);
  });

  it('keeps internal UUIDs distinct from provider event IDs', () => {
    const result = domainEventV1Schema.parse({
      ...validEvent,
      external_event_id: 'evt_mobile_purchase_123',
    });

    expect(result.domain_event_id).toBe(validEvent.domain_event_id);
    expect(result.external_event_id).toBe('evt_mobile_purchase_123');
  });

  it('distinguishes tenant context verification from user authentication', () => {
    const result = domainEventV1Schema.parse({
      ...validEvent,
      producer: 'web',
      trust_level: 'tenant_verified_client',
    });

    expect(result.trust_level).toBe('tenant_verified_client');
  });

  it('rejects an unsupported schema version', () => {
    const result = domainEventV1Schema.safeParse({
      ...validEvent,
      schema_version: 2,
    });

    expect(result.success).toBe(false);
  });
});
