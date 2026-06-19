import { describe, expect, it } from 'vitest';
import { sanitizePostHogExceptionText } from '@/lib/posthog/exception-text';

describe('sanitizePostHogExceptionText', () => {
  it('redacts exception text without keeping URL query secrets', () => {
    expect(
      sanitizePostHogExceptionText(
        'checkout failed at https://ogabassey.com/order-success?trackingToken=track_secret&reference=ref_1234567 for buyer@example.com phone=08012345678 body={"token":"json_secret"}'
      )
    ).toBe(
      'checkout failed at https://ogabassey.com/order-success for [Filtered] phone=[Filtered] body={"token":"[Filtered]"}'
    );
  });
});
