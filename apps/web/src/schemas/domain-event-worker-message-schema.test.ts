import { describe, expect, it } from 'vitest';
import { domainEventWorkerMessageSchema } from './domain-event-worker-message-schema';

const message = {
  enqueued_at: '2026-07-12T12:00:00.000Z',
  message: {},
  msg_id: 1,
  read_ct: 1,
  visible_at: '2026-07-12T12:01:00.000Z',
};

describe('domainEventWorkerMessageSchema', () => {
  it('accepts a strict positive queue message', () => {
    expect(domainEventWorkerMessageSchema.safeParse(message).success).toBe(
      true
    );
  });

  it('rejects nonpositive ids and extra fields', () => {
    expect(
      domainEventWorkerMessageSchema.safeParse({ ...message, msg_id: 0 })
        .success
    ).toBe(false);
    expect(
      domainEventWorkerMessageSchema.safeParse({ ...message, extra: true })
        .success
    ).toBe(false);
  });

  it.each([
    'enqueued_at',
    'visible_at',
  ] as const)('rejects a malformed %s timestamp', (field) => {
    expect(
      domainEventWorkerMessageSchema.safeParse({
        ...message,
        [field]: 'not-a-timestamp',
      }).success
    ).toBe(false);
  });
});
