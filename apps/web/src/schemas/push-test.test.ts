import { describe, expect, it } from 'vitest';
import { adminPushTestSchema } from '@/schemas/push-test';

describe('adminPushTestSchema', () => {
  it('uses defaults when title and body are omitted', () => {
    const parsed = adminPushTestSchema.parse({});

    expect(parsed).toEqual({
      title: 'Baci Push Test',
      body: 'If you received this, admin push notifications are working.',
    });
  });

  it('trims and accepts custom title and body', () => {
    const parsed = adminPushTestSchema.parse({
      title: '  Test title  ',
      body: '  Test body  ',
    });

    expect(parsed).toEqual({
      title: 'Test title',
      body: 'Test body',
    });
  });

  it('rejects an empty title', () => {
    const result = adminPushTestSchema.safeParse({ title: '   ' });

    expect(result.success).toBe(false);
  });
});
