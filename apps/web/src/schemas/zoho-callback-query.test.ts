import { describe, expect, it } from 'vitest';
import { zohoCallbackQuerySchema } from './zoho-callback-query';

describe('zohoCallbackQuerySchema', () => {
  it('parses Zoho callback query parameters', () => {
    expect(
      zohoCallbackQuerySchema.parse({
        code: 'grant-code',
        state: 'state-1',
      })
    ).toEqual({ code: 'grant-code', state: 'state-1' });
  });

  it('rejects empty callback values', () => {
    expect(() =>
      zohoCallbackQuerySchema.parse({ code: '', state: '' })
    ).toThrow();
  });
});
