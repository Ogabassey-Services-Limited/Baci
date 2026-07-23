import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDomainEventMetadata } from './event-metadata';

afterEach(() => vi.unstubAllEnvs());

describe('createDomainEventMetadata', () => {
  it('uses the deployment environment and a bounded trace identifier', () => {
    vi.stubEnv('VERCEL_ENV', 'preview');

    expect(createDomainEventMetadata(' req:abc-123 ')).toEqual({
      environment: 'preview',
      request_id: 'req:abc-123',
    });
  });

  it('omits attacker-controlled request identifiers with unsafe characters', () => {
    vi.stubEnv('VERCEL_ENV', '');
    vi.stubEnv('NODE_ENV', 'test');

    expect(createDomainEventMetadata('user@example.com\nsecret=1')).toEqual({
      environment: 'test',
    });
  });
});
