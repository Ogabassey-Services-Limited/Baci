import { describe, expect, it } from 'vitest';
import { getManifestComponentSchema } from './manifest-component-schema';

describe('manifest component schema', () => {
  it('uses manifest bounds and uniqueness for editable component patches', () => {
    const schema = getManifestComponentSchema('edit');

    expect(
      schema.safeParse({ componentType: 'Button', text: 'x'.repeat(121) })
        .success
    ).toBe(false);
    expect(
      schema.safeParse({
        componentType: 'FAQ',
        items: [
          { answer: 'First', question: 'Shipping' },
          { answer: 'Second', question: 'Shipping' },
        ],
      }).success
    ).toBe(false);
  });

  it('accepts default-only manifest-authorized inserts and rejects protected types', () => {
    const schema = getManifestComponentSchema('insert');

    expect(schema.safeParse({ componentType: 'Button' }).success).toBe(true);
    expect(schema.safeParse({ componentType: 'CodeEmbed' }).success).toBe(
      false
    );
  });
});
